import "server-only";

import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  broadcastCampaigns,
  broadcastRecipients,
  messageTemplates,
} from "@/db/schema/broadcast";
import { conversations } from "@/db/schema/conversations";
import { leads } from "@/db/schema/leads";
import { messages } from "@/db/schema/messages";
import { organizations } from "@/db/schema/organizations";
import { decryptTelegramToken } from "@/lib/crypto/telegram-token";
import {
  MAX_CAMPAIGN_RECIPIENTS,
  type AudienceFilters,
} from "@/lib/broadcast/audience";
import {
  MAX_MESSAGE_LENGTH,
  renderTemplate,
  validateTemplateBody,
} from "@/lib/broadcast/template";
import { sendTelegramMessageDetailed } from "@/server/integrations/telegram";
import { captureError, trackEvent } from "@/server/integrations/watchup";
import { getErrorName, logger } from "@/server/logging";

import {
  getConnectedTelegram,
  resolveAudience,
  summarizeAudience,
} from "./audience";

export class BroadcastError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "BroadcastError";
  }
}

const MAX_ATTEMPTS = 3;
const CLAIM_BATCH_SIZE = 20;
const STALE_CLAIM_MS = 5 * 60_000;
/** Stay well under Telegram's ~30 messages/second global bot limit. */
const SEND_SPACING_MS = 60;

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------ channels ------------------------------ */

export async function getBroadcastChannels(organizationId: string) {
  const connection = await getConnectedTelegram(organizationId);
  const connected = connection?.status === "CONNECTED";
  return [
    {
      channel: "TELEGRAM" as const,
      label: "Telegram",
      available: connected,
      detail: connected
        ? `Sending as @${connection.botUsername}. Only contacts who have messaged this bot can be reached.`
        : "Connect a Telegram bot in Integrations to send broadcasts.",
    },
  ];
}

/* ------------------------------ templates ------------------------------ */

export async function listTemplates(organizationId: string) {
  return getDatabase()
    .select({
      id: messageTemplates.id,
      name: messageTemplates.name,
      body: messageTemplates.body,
      updatedAt: messageTemplates.updatedAt,
    })
    .from(messageTemplates)
    .where(eq(messageTemplates.organizationId, organizationId))
    .orderBy(desc(messageTemplates.updatedAt))
    .limit(100);
}

function assertValidBody(body: string) {
  const problems = validateTemplateBody(body);
  if (problems.length) {
    throw new BroadcastError(problems.join(" "), 400);
  }
}

export async function createTemplate(
  organizationId: string,
  userId: string,
  input: { name: string; body: string },
) {
  assertValidBody(input.body);
  const id = randomUUID();
  try {
    await getDatabase().insert(messageTemplates).values({
      id,
      organizationId,
      name: input.name,
      body: input.body,
      createdBy: userId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BroadcastError("A template with this name already exists", 409);
    }
    throw error;
  }
  return { id };
}

export async function updateTemplate(
  organizationId: string,
  templateId: string,
  input: { name: string; body: string },
) {
  assertValidBody(input.body);
  try {
    const [updated] = await getDatabase()
      .update(messageTemplates)
      .set({ name: input.name, body: input.body, updatedAt: new Date() })
      .where(
        and(
          eq(messageTemplates.id, templateId),
          eq(messageTemplates.organizationId, organizationId),
        ),
      )
      .returning({ id: messageTemplates.id });
    if (!updated) throw new BroadcastError("Template not found", 404);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BroadcastError("A template with this name already exists", 409);
    }
    throw error;
  }
}

export async function deleteTemplate(organizationId: string, templateId: string) {
  const [deleted] = await getDatabase()
    .delete(messageTemplates)
    .where(
      and(
        eq(messageTemplates.id, templateId),
        eq(messageTemplates.organizationId, organizationId),
      ),
    )
    .returning({ id: messageTemplates.id });
  if (!deleted) throw new BroadcastError("Template not found", 404);
}

/* ------------------------------- audience ------------------------------ */

export async function previewAudience(
  organizationId: string,
  filters: AudienceFilters,
) {
  const connection = await getConnectedTelegram(organizationId);
  const activeId = connection?.status === "CONNECTED" ? connection.id : null;
  const { items, overflow } = await resolveAudience(
    organizationId,
    filters,
    activeId,
  );
  return {
    ...summarizeAudience(items),
    overflow,
    maxRecipients: MAX_CAMPAIGN_RECIPIENTS,
    leads: items.slice(0, 300).map((item) => ({
      id: item.id,
      name: item.name,
      stage: item.stage,
      score: item.score,
      eligible: item.eligible,
      reason: item.reason,
    })),
  };
}

/* ------------------------------- campaigns ------------------------------ */

export async function createCampaign(
  organizationId: string,
  userId: string,
  input: {
    name: string;
    body: string;
    templateId?: string | null;
    filters: AudienceFilters;
  },
) {
  assertValidBody(input.body);
  const db = getDatabase();

  if (input.templateId) {
    const [template] = await db
      .select({ id: messageTemplates.id })
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, input.templateId),
          eq(messageTemplates.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!template) throw new BroadcastError("Template not found", 404);
  }

  const id = randomUUID();
  await db.insert(broadcastCampaigns).values({
    id,
    organizationId,
    name: input.name,
    channel: "TELEGRAM",
    status: "DRAFT",
    templateId: input.templateId ?? null,
    body: input.body,
    audienceFilters: input.filters,
    createdBy: userId,
  });
  return { id };
}

type Counts = {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  skipped: number;
};

async function countsByCampaign(organizationId: string, campaignIds: string[]) {
  const result = new Map<string, Counts>();
  if (!campaignIds.length) return result;
  const rows = await getDatabase()
    .select({
      campaignId: broadcastRecipients.campaignId,
      status: broadcastRecipients.status,
      count: count(),
    })
    .from(broadcastRecipients)
    .where(
      and(
        eq(broadcastRecipients.organizationId, organizationId),
        inArray(broadcastRecipients.campaignId, campaignIds),
      ),
    )
    .groupBy(broadcastRecipients.campaignId, broadcastRecipients.status);

  for (const row of rows) {
    const entry =
      result.get(row.campaignId) ??
      { total: 0, pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };
    entry.total += row.count;
    entry[row.status.toLowerCase() as "pending" | "sending" | "sent" | "failed" | "skipped"] += row.count;
    result.set(row.campaignId, entry);
  }
  return result;
}

const emptyCounts: Counts = { total: 0, pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };

export async function listCampaigns(organizationId: string, page = 1, pageSize = 20) {
  const db = getDatabase();
  const offset = (Math.max(page, 1) - 1) * pageSize;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(broadcastCampaigns)
      .where(eq(broadcastCampaigns.organizationId, organizationId))
      .orderBy(desc(broadcastCampaigns.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(broadcastCampaigns)
      .where(eq(broadcastCampaigns.organizationId, organizationId)),
  ]);
  const counts = await countsByCampaign(organizationId, rows.map((row) => row.id));
  return {
    total,
    page,
    pageSize,
    campaigns: rows.map((row) => ({
      id: row.id,
      name: row.name,
      channel: row.channel,
      status: row.status,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      counts: counts.get(row.id) ?? emptyCounts,
    })),
  };
}

export async function getCampaignDetail(
  organizationId: string,
  campaignId: string,
  page = 1,
  pageSize = 50,
) {
  const db = getDatabase();
  const [campaign] = await db
    .select()
    .from(broadcastCampaigns)
    .where(
      and(
        eq(broadcastCampaigns.id, campaignId),
        eq(broadcastCampaigns.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!campaign) throw new BroadcastError("Campaign not found", 404);

  const recipients = await db
    .select({
      id: broadcastRecipients.id,
      leadId: broadcastRecipients.leadId,
      name: broadcastRecipients.recipientName,
      status: broadcastRecipients.status,
      skipReason: broadcastRecipients.skipReason,
      errorCode: broadcastRecipients.errorCode,
      attempts: broadcastRecipients.attempts,
      providerMessageId: broadcastRecipients.providerMessageId,
      sentAt: broadcastRecipients.sentAt,
    })
    .from(broadcastRecipients)
    .where(
      and(
        eq(broadcastRecipients.campaignId, campaignId),
        eq(broadcastRecipients.organizationId, organizationId),
      ),
    )
    .orderBy(broadcastRecipients.createdAt, broadcastRecipients.id)
    .limit(pageSize)
    .offset((Math.max(page, 1) - 1) * pageSize);

  const counts = (await countsByCampaign(organizationId, [campaignId])).get(campaignId) ?? emptyCounts;
  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      body: campaign.body,
      audienceFilters: campaign.audienceFilters,
      createdAt: campaign.createdAt,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
    },
    counts,
    recipients,
    page,
    pageSize,
  };
}

export async function sendCampaign(
  organizationId: string,
  campaignId: string,
  options: { excludedLeadIds: string[] },
) {
  const db = getDatabase();
  const [campaign] = await db
    .select()
    .from(broadcastCampaigns)
    .where(
      and(
        eq(broadcastCampaigns.id, campaignId),
        eq(broadcastCampaigns.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!campaign) throw new BroadcastError("Campaign not found", 404);
  if (campaign.status !== "DRAFT") {
    throw new BroadcastError("This campaign has already been sent or cancelled", 409);
  }
  assertValidBody(campaign.body);

  const connection = await getConnectedTelegram(organizationId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new BroadcastError("Connect Telegram before sending a broadcast", 409);
  }

  const filters = campaign.audienceFilters as AudienceFilters;
  const { items, overflow } = await resolveAudience(organizationId, filters, connection.id);
  if (overflow) {
    throw new BroadcastError(
      `Audience is larger than ${MAX_CAMPAIGN_RECIPIENTS} contacts. Narrow the filters.`,
      409,
    );
  }
  const excluded = new Set(options.excludedLeadIds);
  const audience = items.filter((item) => !excluded.has(item.id));
  const sendable = audience.filter((item) => item.eligible);
  if (!sendable.length) {
    throw new BroadcastError("No eligible recipients to send to", 409);
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    // The status guard makes a double click or concurrent request a no-op.
    const [claimed] = await tx
      .update(broadcastCampaigns)
      .set({ status: "PROCESSING", startedAt: now, updatedAt: now })
      .where(
        and(
          eq(broadcastCampaigns.id, campaignId),
          eq(broadcastCampaigns.organizationId, organizationId),
          eq(broadcastCampaigns.status, "DRAFT"),
        ),
      )
      .returning({ id: broadcastCampaigns.id });
    if (!claimed) {
      throw new BroadcastError("This campaign has already been sent or cancelled", 409);
    }

    for (let offset = 0; offset < audience.length; offset += 500) {
      await tx.insert(broadcastRecipients).values(
        audience.slice(offset, offset + 500).map((item) => ({
          id: randomUUID(),
          campaignId,
          organizationId,
          leadId: item.id,
          recipientName: item.name,
          destination: item.eligible ? item.telegramUserId : null,
          status: item.eligible ? ("PENDING" as const) : ("SKIPPED" as const),
          skipReason: item.reason,
        })),
      );
    }
  });

  trackEvent("broadcast.campaign.started", {
    organizationId,
    campaignId,
    recipients: sendable.length,
    skipped: audience.length - sendable.length,
  });

  return { queued: sendable.length, skipped: audience.length - sendable.length };
}

export async function cancelCampaign(organizationId: string, campaignId: string) {
  const db = getDatabase();
  const now = new Date();
  const cancelled = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(broadcastCampaigns)
      .set({ status: "CANCELLED", completedAt: now, updatedAt: now })
      .where(
        and(
          eq(broadcastCampaigns.id, campaignId),
          eq(broadcastCampaigns.organizationId, organizationId),
          inArray(broadcastCampaigns.status, ["DRAFT", "PROCESSING"]),
        ),
      )
      .returning({ id: broadcastCampaigns.id });
    if (!row) return false;
    await tx
      .update(broadcastRecipients)
      .set({ status: "SKIPPED", skipReason: "CAMPAIGN_CANCELLED", updatedAt: now })
      .where(
        and(
          eq(broadcastRecipients.campaignId, campaignId),
          eq(broadcastRecipients.status, "PENDING"),
        ),
      );
    return true;
  });
  if (!cancelled) {
    throw new BroadcastError("Only draft or in-progress campaigns can be cancelled", 409);
  }
  trackEvent("broadcast.campaign.cancelled", { organizationId, campaignId });
}

/* -------------------------------- consent ------------------------------- */

export async function setLeadBroadcastConsent(
  organizationId: string,
  leadId: string,
  optedOut: boolean,
) {
  const [row] = await getDatabase()
    .update(leads)
    .set({
      broadcastOptedOutAt: optedOut ? new Date() : null,
      broadcastOptOutReason: optedOut ? "MANUAL" : null,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
    .returning({ id: leads.id, broadcastOptedOutAt: leads.broadcastOptedOutAt });
  if (!row) throw new BroadcastError("Lead not found", 404);
  return { optedOut: row.broadcastOptedOutAt !== null };
}

/** Called when a contact replies with a stop keyword to the connected bot. */
export async function recordTelegramOptOut(
  organizationId: string,
  telegramUserId: string,
) {
  await getDatabase()
    .update(leads)
    .set({
      broadcastOptedOutAt: new Date(),
      broadcastOptOutReason: "USER_STOP",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(leads.organizationId, organizationId),
        eq(leads.telegramUserId, telegramUserId),
        sql`${leads.broadcastOptedOutAt} is null`,
      ),
    );
}

export const STOP_KEYWORDS = new Set(["stop", "/stop", "unsubscribe", "opt out", "optout"]);

export function isStopKeyword(text: string | undefined | null) {
  return STOP_KEYWORDS.has((text ?? "").trim().toLowerCase());
}

/* ---------------------------- delivery worker --------------------------- */

type ClaimedRecipient = {
  id: string;
  lead_id: string | null;
  destination: string | null;
  attempts: number;
};

async function claimBatch(organizationId: string, campaignId: string) {
  const result = await getDatabase().execute<ClaimedRecipient>(sql`
    update broadcast_recipients
    set status = 'SENDING', claimed_at = now(), attempts = attempts + 1, updated_at = now()
    where id in (
      select id from broadcast_recipients
      where campaign_id = ${campaignId}
        and organization_id = ${organizationId}
        and status = 'PENDING'
        and next_attempt_at <= now()
      order by created_at, id
      limit ${CLAIM_BATCH_SIZE}
      for update skip locked
    )
    returning id, lead_id, destination, attempts
  `);
  return result.rows;
}

async function markRecipient(
  id: string,
  values: Partial<typeof broadcastRecipients.$inferInsert>,
) {
  await getDatabase()
    .update(broadcastRecipients)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(broadcastRecipients.id, id));
}

async function recordSentMessage(
  organizationId: string,
  leadId: string,
  content: string,
) {
  try {
    const db = getDatabase();
    await db
      .insert(conversations)
      .values({
        id: randomUUID(),
        organizationId,
        leadId,
        channel: "TELEGRAM",
        status: "ACTIVE",
        aiPaused: false,
      })
      .onConflictDoNothing();
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          eq(conversations.leadId, leadId),
          eq(conversations.channel, "TELEGRAM"),
        ),
      )
      .limit(1);
    if (!conversation) return;
    await db.insert(messages).values({
      id: randomUUID(),
      organizationId,
      conversationId: conversation.id,
      role: "ASSISTANT",
      content,
      channel: "TELEGRAM",
    });
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversation.id));
  } catch (error) {
    // The message already went out; losing the transcript copy must not fail it.
    logger.warn("broadcast.transcript.failed", { errorName: getErrorName(error) });
  }
}

async function finalizeIfDone(organizationId: string, campaignId: string) {
  const counts = (await countsByCampaign(organizationId, [campaignId])).get(campaignId) ?? emptyCounts;
  if (counts.pending > 0 || counts.sending > 0) return false;

  const status =
    counts.failed === 0
      ? "COMPLETED"
      : counts.sent === 0
        ? "FAILED"
        : "PARTIALLY_FAILED";
  const [updated] = await getDatabase()
    .update(broadcastCampaigns)
    .set({ status, completedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(broadcastCampaigns.id, campaignId),
        eq(broadcastCampaigns.organizationId, organizationId),
        eq(broadcastCampaigns.status, "PROCESSING"),
      ),
    )
    .returning({ id: broadcastCampaigns.id });

  if (updated) {
    trackEvent("broadcast.campaign.finished", {
      organizationId,
      campaignId,
      status,
      sent: counts.sent,
      failed: counts.failed,
      skipped: counts.skipped,
    });
    if (status !== "COMPLETED") {
      logger.warn("broadcast.campaign.failures", {
        organizationId,
        campaignId,
        status,
        failed: counts.failed,
      });
    }
  }
  return true;
}

/**
 * Sends pending recipients for one campaign until the time budget is used.
 * Safe to call concurrently: rows are claimed with FOR UPDATE SKIP LOCKED and
 * a message is never re-sent after an ambiguous outcome.
 */
export async function processCampaign(
  organizationId: string,
  campaignId: string,
  budgetMs = 45_000,
) {
  const db = getDatabase();
  const deadline = Date.now() + budgetMs;

  await db
    .update(broadcastRecipients)
    .set({ status: "FAILED", errorCode: "UNKNOWN_OUTCOME", updatedAt: new Date() })
    .where(
      and(
        eq(broadcastRecipients.campaignId, campaignId),
        eq(broadcastRecipients.organizationId, organizationId),
        eq(broadcastRecipients.status, "SENDING"),
        sql`${broadcastRecipients.claimedAt} < ${new Date(Date.now() - STALE_CLAIM_MS)}`,
      ),
    );

  const [campaign] = await db
    .select()
    .from(broadcastCampaigns)
    .where(
      and(
        eq(broadcastCampaigns.id, campaignId),
        eq(broadcastCampaigns.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!campaign || campaign.status !== "PROCESSING") return;

  const [organization] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const connection = await getConnectedTelegram(organizationId);

  if (!connection || connection.status !== "CONNECTED") {
    await db
      .update(broadcastRecipients)
      .set({ status: "FAILED", errorCode: "CHANNEL_DISCONNECTED", updatedAt: new Date() })
      .where(
        and(
          eq(broadcastRecipients.campaignId, campaignId),
          eq(broadcastRecipients.status, "PENDING"),
        ),
      );
    await finalizeIfDone(organizationId, campaignId);
    return;
  }

  const token = decryptTelegramToken({
    ciphertext: connection.encryptedBotToken,
    iv: connection.encryptionIv,
    authTag: connection.encryptionAuthTag,
  });

  while (Date.now() < deadline) {
    const [current] = await db
      .select({ status: broadcastCampaigns.status })
      .from(broadcastCampaigns)
      .where(eq(broadcastCampaigns.id, campaignId))
      .limit(1);
    if (current?.status !== "PROCESSING") return;

    const batch = await claimBatch(organizationId, campaignId);
    if (!batch.length) {
      if (await finalizeIfDone(organizationId, campaignId)) return;
      // Rows exist but are delayed (retry backoff) or held by another worker.
      const wait = Math.min(2_000, deadline - Date.now());
      if (wait <= 0) return;
      await sleep(wait);
      continue;
    }

    for (let index = 0; index < batch.length; index += 1) {
      const row = batch[index];
      const outcome = await deliverOne(
        organizationId,
        organization?.name ?? null,
        campaign.body,
        token,
        row,
      );

      if (outcome.rateLimitedUntil) {
        // Give the unprocessed remainder back untouched and back off.
        const rest = batch.slice(index + 1).map((item) => item.id);
        if (rest.length) {
          await db
            .update(broadcastRecipients)
            .set({
              status: "PENDING",
              attempts: sql`${broadcastRecipients.attempts} - 1`,
              nextAttemptAt: outcome.rateLimitedUntil,
              updatedAt: new Date(),
            })
            .where(inArray(broadcastRecipients.id, rest));
        }
        const wait = outcome.rateLimitedUntil.getTime() - Date.now();
        if (Date.now() + wait >= deadline) return;
        await sleep(Math.max(wait, 0));
        break;
      }
      await sleep(SEND_SPACING_MS);
    }
  }
}

async function deliverOne(
  organizationId: string,
  businessName: string | null,
  body: string,
  token: string,
  row: ClaimedRecipient,
): Promise<{ rateLimitedUntil?: Date }> {
  try {
    if (!row.lead_id) {
      await markRecipient(row.id, { status: "SKIPPED", skipReason: "LEAD_DELETED" });
      return {};
    }
    const [lead] = await getDatabase()
      .select({
        id: leads.id,
        name: leads.name,
        location: leads.location,
        need: leads.need,
        telegramUserId: leads.telegramUserId,
        broadcastOptedOutAt: leads.broadcastOptedOutAt,
      })
      .from(leads)
      .where(and(eq(leads.id, row.lead_id), eq(leads.organizationId, organizationId)))
      .limit(1);

    if (!lead) {
      await markRecipient(row.id, { status: "SKIPPED", skipReason: "LEAD_DELETED" });
      return {};
    }
    // Consent is re-checked at send time: the contact may have opted out since queueing.
    if (lead.broadcastOptedOutAt) {
      await markRecipient(row.id, { status: "SKIPPED", skipReason: "OPTED_OUT" });
      return {};
    }
    const chatId = Number(row.destination);
    if (!row.destination || !Number.isSafeInteger(chatId) || chatId <= 0) {
      await markRecipient(row.id, { status: "FAILED", errorCode: "INVALID_DESTINATION" });
      return {};
    }

    const text = renderTemplate(body, {
      name: lead.name,
      location: lead.location,
      need: lead.need,
      businessName,
    }).trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH || /\{\{|\}\}/.test(text)) {
      await markRecipient(row.id, { status: "FAILED", errorCode: "INVALID_CONTENT" });
      return {};
    }

    const result = await sendTelegramMessageDetailed(token, chatId, text);

    if (result.ok) {
      await markRecipient(row.id, {
        status: "SENT",
        providerMessageId: String(result.messageId),
        sentAt: new Date(),
        errorCode: null,
      });
      await recordSentMessage(organizationId, lead.id, text);
      return {};
    }

    switch (result.kind) {
      case "RATE_LIMITED": {
        if (row.attempts >= MAX_ATTEMPTS + 2) {
          await markRecipient(row.id, { status: "FAILED", errorCode: "RATE_LIMITED" });
          return {};
        }
        const until = new Date(Date.now() + (result.retryAfterSeconds ?? 5) * 1_000);
        await markRecipient(row.id, { status: "PENDING", nextAttemptAt: until });
        return { rateLimitedUntil: until };
      }
      case "TRANSIENT": {
        if (row.attempts >= MAX_ATTEMPTS) {
          await markRecipient(row.id, { status: "FAILED", errorCode: "PROVIDER_ERROR" });
        } else {
          await markRecipient(row.id, {
            status: "PENDING",
            nextAttemptAt: new Date(Date.now() + 2 ** row.attempts * 3_000),
          });
        }
        return {};
      }
      case "BLOCKED":
        await markRecipient(row.id, { status: "FAILED", errorCode: "RECIPIENT_BLOCKED" });
        await getDatabase()
          .update(leads)
          .set({ broadcastOptedOutAt: new Date(), broadcastOptOutReason: "BLOCKED_BOT" })
          .where(
            and(
              eq(leads.id, lead.id),
              eq(leads.organizationId, organizationId),
              sql`${leads.broadcastOptedOutAt} is null`,
            ),
          );
        return {};
      case "UNAUTHORIZED":
        await markRecipient(row.id, { status: "FAILED", errorCode: "CHANNEL_UNAUTHORIZED" });
        return {};
      case "INVALID":
        await markRecipient(row.id, { status: "FAILED", errorCode: "REJECTED_BY_PROVIDER" });
        return {};
      default:
        // The request may have been delivered; never resend automatically.
        await markRecipient(row.id, { status: "FAILED", errorCode: "UNKNOWN_OUTCOME" });
        return {};
    }
  } catch (error) {
    logger.error("broadcast.recipient.failed", {
      organizationId,
      errorName: getErrorName(error),
    });
    captureError(error, "broadcast.recipient");
    try {
      await markRecipient(row.id, { status: "FAILED", errorCode: "INTERNAL_ERROR" });
    } catch {
      // Leave SENDING; the stale-claim sweep will close it as UNKNOWN_OUTCOME.
    }
    return {};
  }
}

/** Resumes every in-progress campaign; intended for an external cron trigger. */
export async function processAllActiveCampaigns(budgetMs = 50_000) {
  const active = await getDatabase()
    .select({
      id: broadcastCampaigns.id,
      organizationId: broadcastCampaigns.organizationId,
    })
    .from(broadcastCampaigns)
    .where(eq(broadcastCampaigns.status, "PROCESSING"))
    .orderBy(broadcastCampaigns.startedAt)
    .limit(20);

  const deadline = Date.now() + budgetMs;
  for (const campaign of active) {
    const remaining = deadline - Date.now();
    if (remaining <= 1_000) break;
    await processCampaign(campaign.organizationId, campaign.id, remaining);
  }
  return { campaigns: active.length };
}

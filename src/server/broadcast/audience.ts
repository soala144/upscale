import "server-only";

import { and, asc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import { getDatabase } from "@/db";
import { leads } from "@/db/schema/leads";
import { telegramConnections } from "@/db/schema/telegram-connections";
import {
  evaluateEligibility,
  MAX_CAMPAIGN_RECIPIENTS,
  type AudienceFilters,
  type IneligibleReason,
} from "@/lib/broadcast/audience";

export type AudienceLead = {
  id: string;
  name: string | null;
  stage: (typeof leads.$inferSelect)["stage"];
  score: number;
  telegramUserId: string | null;
  location: string | null;
  need: string | null;
  eligible: boolean;
  reason: IneligibleReason | null;
};

export async function getConnectedTelegram(organizationId: string) {
  const [connection] = await getDatabase()
    .select({
      id: telegramConnections.id,
      botUsername: telegramConnections.botUsername,
      status: telegramConnections.status,
      encryptedBotToken: telegramConnections.encryptedBotToken,
      encryptionIv: telegramConnections.encryptionIv,
      encryptionAuthTag: telegramConnections.encryptionAuthTag,
    })
    .from(telegramConnections)
    .where(eq(telegramConnections.organizationId, organizationId))
    .limit(1);
  return connection ?? null;
}

export function buildAudienceCondition(
  organizationId: string,
  filters: AudienceFilters,
): SQL {
  // Organization scope is always the first predicate; filters can only narrow it.
  const conditions: Array<SQL | undefined> = [
    eq(leads.organizationId, organizationId),
  ];

  if (filters.leadIds?.length) {
    conditions.push(inArray(leads.id, filters.leadIds));
  } else {
    if (filters.stages?.length) {
      conditions.push(inArray(leads.stage, filters.stages));
    }
    if (filters.scoreMin !== undefined) {
      conditions.push(gte(leads.score, filters.scoreMin));
    }
    if (filters.scoreMax !== undefined) {
      conditions.push(lte(leads.score, filters.scoreMax));
    }
    if (filters.createdFrom) {
      conditions.push(gte(leads.createdAt, new Date(filters.createdFrom)));
    }
    if (filters.createdTo) {
      conditions.push(lte(leads.createdAt, new Date(filters.createdTo)));
    }
    if (filters.notContactedSince) {
      const since = new Date(filters.notContactedSince);
      conditions.push(sql`not exists (
        select 1 from messages m
        inner join conversations c on c.id = m.conversation_id
        where c.lead_id = ${leads.id}
          and c.organization_id = ${organizationId}
          and m.role in ('ASSISTANT', 'HUMAN')
          and m.created_at >= ${since}
      )`);
    }
  }

  return and(...conditions) as SQL;
}

/**
 * Resolves the matching leads (organization-scoped) with their eligibility.
 * Fetches one more than the campaign cap so callers can detect overflow.
 */
export async function resolveAudience(
  organizationId: string,
  filters: AudienceFilters,
  activeConnectionId: string | null,
) {
  const rows = await getDatabase()
    .select({
      id: leads.id,
      name: leads.name,
      stage: leads.stage,
      score: leads.score,
      telegramUserId: leads.telegramUserId,
      telegramConnectionId: leads.telegramConnectionId,
      broadcastOptedOutAt: leads.broadcastOptedOutAt,
      location: leads.location,
      need: leads.need,
    })
    .from(leads)
    .where(buildAudienceCondition(organizationId, filters))
    .orderBy(asc(leads.createdAt), asc(leads.id))
    .limit(MAX_CAMPAIGN_RECIPIENTS + 1);

  const overflow = rows.length > MAX_CAMPAIGN_RECIPIENTS;
  const items: AudienceLead[] = rows
    .slice(0, MAX_CAMPAIGN_RECIPIENTS)
    .map((row) => {
      const reason = evaluateEligibility(row, activeConnectionId);
      return {
        id: row.id,
        name: row.name,
        stage: row.stage,
        score: row.score,
        telegramUserId: row.telegramUserId,
        location: row.location,
        need: row.need,
        eligible: reason === null,
        reason,
      };
    });

  return { items, overflow };
}

export function summarizeAudience(items: AudienceLead[]) {
  const ineligible = { OPTED_OUT: 0, NO_DESTINATION: 0, NOT_CONNECTED: 0 };
  let eligible = 0;
  for (const item of items) {
    if (item.reason) ineligible[item.reason] += 1;
    else eligible += 1;
  }
  return { total: items.length, eligible, ineligible };
}

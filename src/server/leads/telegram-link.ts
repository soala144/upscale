import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { leads } from "@/db/schema/leads";

/**
 * Connects a lead created through the web form to the Telegram user who opened
 * the deep link. Only unlinked leads can be claimed, and if this Telegram user
 * already has a lead the unique index rejects it and the chat continues there.
 */
export async function linkFormLeadToTelegram(input: {
  organizationId: string;
  connectionId: string;
  leadId: string;
  telegramUserId: string;
}) {
  try {
    await getDatabase()
      .update(leads)
      .set({
        telegramUserId: input.telegramUserId,
        telegramConnectionId: input.connectionId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leads.id, input.leadId),
          eq(leads.organizationId, input.organizationId),
          sql`${leads.telegramUserId} is null`,
        ),
      );
  } catch (error) {
    if (!(error instanceof Error && "code" in error && (error as { code?: string }).code === "23505")) {
      throw error;
    }
  }
}

/** Records which link a brand-new Telegram lead came from (e.g. TELEGRAM:instagram). */
export async function tagTelegramLeadSource(
  organizationId: string,
  telegramUserId: string,
  tag: string,
) {
  await getDatabase()
    .update(leads)
    .set({ source: `TELEGRAM:${tag}` })
    .where(
      and(
        eq(leads.organizationId, organizationId),
        eq(leads.telegramUserId, telegramUserId),
        eq(leads.source, "TELEGRAM"),
      ),
    );
}

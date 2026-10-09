import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { conversations } from "@/db/schema/conversations";
import { leads } from "@/db/schema/leads";
import { messages } from "@/db/schema/messages";
import { decryptTelegramToken } from "@/lib/crypto/telegram-token";
import { isValidTelegramChatId } from "@/lib/broadcast/audience";
import { getConnectedTelegram } from "@/server/broadcast/audience";
import { sendTelegramMessageDetailed } from "@/server/integrations/telegram";
import { trackEvent } from "@/server/integrations/watchup";

export class ConversationError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "ConversationError";
  }
}

async function findConversation(organizationId: string, leadId: string) {
  const [conversation] = await getDatabase()
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.organizationId, organizationId),
        eq(conversations.leadId, leadId),
        eq(conversations.channel, "TELEGRAM"),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  return conversation ?? null;
}

/**
 * Take over (paused = true) or hand the chat back to the assistant (paused = false).
 * Handing back also clears the lead's human-follow-up flag so the AI answers again.
 */
export async function setAiPaused(
  organizationId: string,
  leadId: string,
  paused: boolean,
) {
  const conversation = await findConversation(organizationId, leadId);
  if (!conversation) throw new ConversationError("Conversation not found", 404);

  await getDatabase().transaction(async (tx) => {
    await tx
      .update(conversations)
      .set({ aiPaused: paused, updatedAt: new Date() })
      .where(
        and(
          eq(conversations.id, conversation.id),
          eq(conversations.organizationId, organizationId),
        ),
      );
    if (!paused) {
      await tx
        .update(leads)
        .set({ handedOff: false, updatedAt: new Date() })
        .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)));
    }
  });
  trackEvent(paused ? "conversation.taken_over" : "conversation.handed_back", {
    organizationId,
    leadId,
  });
  return { aiPaused: paused };
}

/** Sends a human-written reply to the customer on Telegram and pauses the AI. */
export async function sendHumanReply(
  organizationId: string,
  leadId: string,
  content: string,
) {
  const text = content.trim();
  if (!text || text.length > 4096) {
    throw new ConversationError("Write a message of up to 4,096 characters.", 400);
  }

  const [lead] = await getDatabase()
    .select({ id: leads.id, telegramUserId: leads.telegramUserId })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
    .limit(1);
  if (!lead) throw new ConversationError("Lead not found", 404);
  if (!isValidTelegramChatId(lead.telegramUserId)) {
    throw new ConversationError(
      "This lead is not on Telegram yet, so there is nowhere to send a reply.",
      409,
    );
  }

  const conversation = await findConversation(organizationId, leadId);
  if (!conversation) throw new ConversationError("Conversation not found", 404);

  const connection = await getConnectedTelegram(organizationId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new ConversationError("Connect Telegram before replying to customers.", 409);
  }

  const token = decryptTelegramToken({
    ciphertext: connection.encryptedBotToken,
    iv: connection.encryptionIv,
    authTag: connection.encryptionAuthTag,
  });
  const result = await sendTelegramMessageDetailed(token, Number(lead.telegramUserId), text);
  if (!result.ok) {
    // 409 rather than 5xx: the hosting proxy replaces 5xx bodies, hiding the reason.
    const reason =
      result.kind === "BLOCKED"
        ? "The customer has blocked the bot, so the message could not be delivered."
        : result.kind === "RATE_LIMITED"
          ? "Telegram is rate limiting this bot. Wait a moment and try again."
          : "Telegram did not accept the message. Try again.";
    throw new ConversationError(reason, 409);
  }

  const messageId = randomUUID();
  await getDatabase().transaction(async (tx) => {
    await tx.insert(messages).values({
      id: messageId,
      organizationId,
      conversationId: conversation.id,
      role: "HUMAN",
      content: text,
      channel: "TELEGRAM",
    });
    // A person is now in the chat, so the assistant must stop answering.
    await tx
      .update(conversations)
      .set({ aiPaused: true, updatedAt: new Date() })
      .where(eq(conversations.id, conversation.id));
  });
  trackEvent("conversation.human_reply", { organizationId, leadId });
  return { id: messageId, aiPaused: true };
}

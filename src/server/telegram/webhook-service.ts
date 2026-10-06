import "server-only";

import "server-only";

import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { getDatabase } from "@/db";
import { messages } from "@/db/schema/messages";
import { telegramConnections } from "@/db/schema/telegram-connections";
import { telegramUpdates } from "@/db/schema/telegram-updates";
import { decryptTelegramToken } from "@/lib/crypto/telegram-token";
import { sendTelegramMessage } from "@/server/integrations/telegram";
import { processConversationMessage } from "@/server/conversations/processor";
import type { telegramUpdateSchema } from "@/lib/validation/telegram";
import type { z } from "zod";

type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
type TelegramConnection = typeof telegramConnections.$inferSelect;

const PROCESSING_LEASE_MS = 5 * 60 * 1_000;

async function completeUpdate(updateId: string) {
  await getDatabase()
    .update(telegramUpdates)
    .set({
      status: "PROCESSED",
      processedAt: new Date(),
    })
    .where(eq(telegramUpdates.id, updateId));
}

async function deliverPendingReply(
  connection: TelegramConnection,
  update: TelegramUpdate,
  receipt: typeof telegramUpdates.$inferSelect,
) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
  if (
    receipt.status === "SENDING" &&
    receipt.processingStartedAt &&
    receipt.processingStartedAt > staleBefore
  ) {
    return { duplicate: true, inProgress: true };
  }

  const [claimed] = await getDatabase()
    .update(telegramUpdates)
    .set({ status: "SENDING", processingStartedAt: now })
    .where(
      and(
        eq(telegramUpdates.id, receipt.id),
        or(
          eq(telegramUpdates.status, "REPLY_PENDING"),
          and(
            eq(telegramUpdates.status, "SENDING"),
            or(
              isNull(telegramUpdates.processingStartedAt),
              lte(telegramUpdates.processingStartedAt, staleBefore),
            ),
          ),
        ),
      ),
    )
    .returning({ id: telegramUpdates.id });

  if (!claimed) {
    return { duplicate: true, inProgress: true };
  }

  if (!update.message || !receipt.assistantMessageId) {
    await completeUpdate(receipt.id);
    return { processed: true, replySent: false };
  }

  try {
    const [assistantMessage] = await getDatabase()
      .select({ content: messages.content })
      .from(messages)
      .where(
        and(
          eq(messages.id, receipt.assistantMessageId),
          eq(messages.organizationId, connection.organizationId),
        ),
      )
      .limit(1);

    if (!assistantMessage) {
      throw new Error("Pending Telegram reply was not found");
    }

    const token = decryptTelegramToken({
      ciphertext: connection.encryptedBotToken,
      iv: connection.encryptionIv,
      authTag: connection.encryptionAuthTag,
    });
    await sendTelegramMessage(
      token,
      update.message.chat.id,
      assistantMessage.content,
    );
    await getDatabase()
      .update(telegramUpdates)
      .set({ status: "PROCESSED", processedAt: new Date() })
      .where(
        and(
          eq(telegramUpdates.id, receipt.id),
          eq(telegramUpdates.status, "SENDING"),
          eq(telegramUpdates.processingStartedAt, now),
        ),
      );

    return { processed: true, replySent: true };
  } catch (error) {
    await getDatabase()
      .update(telegramUpdates)
      .set({ status: "REPLY_PENDING" })
      .where(
        and(
          eq(telegramUpdates.id, receipt.id),
          eq(telegramUpdates.status, "SENDING"),
          eq(telegramUpdates.processingStartedAt, now),
        ),
      );
    throw error;
  }
}

export async function processTelegramUpdate(
  connection: TelegramConnection,
  update: TelegramUpdate,
) {
  const db = getDatabase();
  const [receipt] = await db
    .select()
    .from(telegramUpdates)
    .where(
      and(
        eq(telegramUpdates.connectionId, connection.id),
        eq(telegramUpdates.updateId, update.update_id),
      ),
    )
    .limit(1);

  if (!receipt) {
    throw new Error("Telegram update receipt was not found");
  }
  if (receipt.status === "PROCESSED") {
    return { duplicate: true, processed: true };
  }
  if (receipt.status === "REPLY_PENDING" || receipt.status === "SENDING") {
    return deliverPendingReply(connection, update, receipt);
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
  if (
    receipt.status === "PROCESSING" &&
    receipt.processingStartedAt &&
    receipt.processingStartedAt > staleBefore
  ) {
    return { duplicate: true, inProgress: true };
  }

  const [claimed] = await db
    .update(telegramUpdates)
    .set({
      status: "PROCESSING",
      processingStartedAt: now,
    })
    .where(
      and(
        eq(telegramUpdates.id, receipt.id),
        or(
          inArray(telegramUpdates.status, ["RECEIVED", "FAILED"]),
          and(
            eq(telegramUpdates.status, "PROCESSING"),
            or(
              isNull(telegramUpdates.processingStartedAt),
              lte(telegramUpdates.processingStartedAt, staleBefore),
            ),
          ),
        ),
      ),
    )
    .returning({ id: telegramUpdates.id });

  if (!claimed) {
    return { duplicate: true, inProgress: true };
  }

  try {
    const message = update.message;
    if (!message?.text || !message.from || message.from.is_bot) {
      await completeUpdate(receipt.id);
      return { processed: true, replySent: false };
    }

    const displayName = [
      message.from.first_name,
      message.from.last_name,
    ]
      .filter(Boolean)
      .join(" ");
    const processed = await processConversationMessage({
      organizationId: connection.organizationId,
      channel: "TELEGRAM",
      externalUserId: String(message.from.id),
      telegramConnectionId: connection.id,
      displayName: displayName || undefined,
      content: message.text,
      updateReceiptId: receipt.id,
    });

    if (!processed.reply || processed.paused) {
      await completeUpdate(receipt.id);
      return { processed: true, replySent: false };
    }

    const [replyReceipt] = await db
      .select()
      .from(telegramUpdates)
      .where(eq(telegramUpdates.id, receipt.id))
      .limit(1);
    if (!replyReceipt) {
      throw new Error("Telegram update receipt was not found");
    }

    return deliverPendingReply(connection, update, replyReceipt);
  } catch (error) {
    await db
      .update(telegramUpdates)
      .set({ status: "FAILED" })
      .where(
        and(
          eq(telegramUpdates.id, receipt.id),
          eq(telegramUpdates.status, "PROCESSING"),
          eq(telegramUpdates.processingStartedAt, now),
        ),
      );
    throw error;
  }
}

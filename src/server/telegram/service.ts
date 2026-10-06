import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { telegramConnections } from "@/db/schema/telegram-connections";
import {
  decryptTelegramToken,
  encryptTelegramToken,
  generateTelegramWebhookSecret,
  hashTelegramWebhookSecret,
} from "@/lib/crypto/telegram-token";
import { getServerEnv } from "@/lib/env/server";
import {
  deleteTelegramWebhook,
  getTelegramBot,
  registerTelegramWebhook,
} from "@/server/integrations/telegram";
import { trackEvent } from "@/server/integrations/watchup";

export class TelegramConnectionError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "TelegramConnectionError";
  }
}

function getPostgresUniqueConstraint(error: unknown) {
  if (
    !(error instanceof Error) ||
    !("code" in error) ||
    error.code !== "23505"
  ) {
    return null;
  }

  return "constraint" in error && typeof error.constraint === "string"
    ? error.constraint
    : "";
}

export async function connectTelegram(
  organizationId: string,
  botToken: string,
) {
  const env = getServerEnv();
  const existingUrl = new URL(env.BETTER_AUTH_URL);
  if (existingUrl.protocol !== "https:") {
    throw new TelegramConnectionError(
      "Telegram webhooks require an HTTPS application URL",
      409,
    );
  }

  const bot = await getTelegramBot(botToken);
  const connectionId = randomUUID();
  const webhookSecret = generateTelegramWebhookSecret();
  const encryptedToken = encryptTelegramToken(botToken);
  const [existingConnection] = await getDatabase()
    .select({
      id: telegramConnections.id,
      status: telegramConnections.status,
    })
    .from(telegramConnections)
    .where(eq(telegramConnections.organizationId, organizationId))
    .limit(1);

  if (
    existingConnection &&
    existingConnection.status !== "DISCONNECTED"
  ) {
    throw new TelegramConnectionError(
      "Disconnect the existing Telegram bot before connecting another",
      409,
    );
  }

  const now = new Date();
  try {
    if (existingConnection) {
      const [updatedConnection] = await getDatabase()
        .update(telegramConnections)
        .set({
          botId: String(bot.id),
          botUsername: bot.username,
          botName: bot.first_name,
          encryptedBotToken: encryptedToken.ciphertext,
          encryptionIv: encryptedToken.iv,
          encryptionAuthTag: encryptedToken.authTag,
          webhookSecretHash: hashTelegramWebhookSecret(webhookSecret),
          status: "PENDING",
          updatedAt: now,
        })
        .where(
          and(
            eq(telegramConnections.id, existingConnection.id),
            eq(telegramConnections.status, "DISCONNECTED"),
          ),
        )
        .returning({ id: telegramConnections.id });

      if (!updatedConnection) {
        throw new TelegramConnectionError(
          "Telegram connection changed; try again",
          409,
        );
      }
    } else {
      await getDatabase().insert(telegramConnections).values({
        id: connectionId,
        organizationId,
        botId: String(bot.id),
        botUsername: bot.username,
        botName: bot.first_name,
        encryptedBotToken: encryptedToken.ciphertext,
        encryptionIv: encryptedToken.iv,
        encryptionAuthTag: encryptedToken.authTag,
        webhookSecretHash: hashTelegramWebhookSecret(webhookSecret),
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    if (error instanceof TelegramConnectionError) {
      throw error;
    }
    const uniqueConstraint = getPostgresUniqueConstraint(error);
    if (uniqueConstraint === "telegram_connections_bot_id_uidx") {
      throw new TelegramConnectionError(
        "This Telegram bot is already connected to another organization",
        409,
      );
    }
    if (uniqueConstraint === "telegram_connections_organization_uidx") {
      throw new TelegramConnectionError(
        "Disconnect the existing Telegram bot before connecting another",
        409,
      );
    }
    throw error;
  }

  const activeConnectionId = existingConnection?.id ?? connectionId;
  const webhookUrl = new URL(
    `/api/webhooks/telegram/${activeConnectionId}`,
    env.BETTER_AUTH_URL,
  ).toString();

  try {
    await registerTelegramWebhook(botToken, webhookUrl, webhookSecret);
  } catch (error) {
    await getDatabase()
      .update(telegramConnections)
      .set({ status: "ERROR", updatedAt: new Date() })
      .where(eq(telegramConnections.id, activeConnectionId));
    throw error;
  }

  await getDatabase()
    .update(telegramConnections)
    .set({ status: "CONNECTED", updatedAt: new Date() })
    .where(eq(telegramConnections.id, activeConnectionId));

  trackEvent("telegram.connected", {
    organizationId,
    connectionId: activeConnectionId,
    botId: String(bot.id),
  });

  return {
    id: activeConnectionId,
    botId: String(bot.id),
    botUsername: bot.username,
    botName: bot.first_name,
    status: "CONNECTED" as const,
  };
}

export async function disconnectTelegram(organizationId: string) {
  const [connection] = await getDatabase()
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.organizationId, organizationId))
    .limit(1);

  if (!connection || connection.status === "DISCONNECTED") {
    return { status: "DISCONNECTED" as const };
  }

  const token = decryptTelegramToken({
    ciphertext: connection.encryptedBotToken,
    iv: connection.encryptionIv,
    authTag: connection.encryptionAuthTag,
  });
  await deleteTelegramWebhook(token);

  await getDatabase()
    .update(telegramConnections)
    .set({ status: "DISCONNECTED", updatedAt: new Date() })
    .where(eq(telegramConnections.id, connection.id));

  trackEvent("telegram.disconnected", {
    organizationId,
    connectionId: connection.id,
  });

  return { status: "DISCONNECTED" as const };
}

export async function getTelegramConnectionStatus(organizationId: string) {
  const [connection] = await getDatabase()
    .select({
      id: telegramConnections.id,
      botId: telegramConnections.botId,
      botUsername: telegramConnections.botUsername,
      botName: telegramConnections.botName,
      status: telegramConnections.status,
    })
    .from(telegramConnections)
    .where(eq(telegramConnections.organizationId, organizationId))
    .limit(1);

  return connection ?? null;
}

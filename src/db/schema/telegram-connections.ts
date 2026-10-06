import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations";

export const telegramConnectionStatusEnum = pgEnum(
  "telegram_connection_status",
  ["PENDING", "CONNECTED", "DISCONNECTED", "ERROR"],
);

export const telegramConnections = pgTable(
  "telegram_connections",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    botId: text("bot_id").notNull(),
    botUsername: text("bot_username").notNull(),
    botName: text("bot_name"),
    encryptedBotToken: text("encrypted_bot_token").notNull(),
    encryptionIv: text("encryption_iv").notNull(),
    encryptionAuthTag: text("encryption_auth_tag").notNull(),
    webhookSecretHash: text("webhook_secret_hash").notNull(),
    status: telegramConnectionStatusEnum("status")
      .notNull()
      .default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("telegram_connections_organization_uidx").on(
      table.organizationId,
    ),
    uniqueIndex("telegram_connections_bot_id_uidx").on(table.botId),
    index("telegram_connections_status_idx").on(table.status),
  ],
);

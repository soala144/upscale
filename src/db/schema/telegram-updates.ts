import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { conversations } from "./conversations";
import { leads } from "./leads";
import { messages } from "./messages";
import { telegramConnections } from "./telegram-connections";

export const telegramUpdates = pgTable(
  "telegram_updates",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => telegramConnections.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    userMessageId: text("user_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    assistantMessageId: text("assistant_message_id").references(
      () => messages.id,
      { onDelete: "set null" },
    ),
    updateId: bigint("update_id", { mode: "number" }).notNull(),
    status: text("status").notNull().default("RECEIVED"),
    processingStartedAt: timestamp("processing_started_at", {
      withTimezone: true,
    }),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("telegram_updates_connection_update_uidx").on(
      table.connectionId,
      table.updateId,
    ),
    index("telegram_updates_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);

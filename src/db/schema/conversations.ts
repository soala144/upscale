import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";

import { leads } from "./leads";
import { organizations } from "./organizations";

export const conversationChannelEnum = pgEnum("conversation_channel", [
  "TELEGRAM",
  "WEB",
]);
export const conversationStatusEnum = pgEnum("conversation_status", [
  "ACTIVE",
  "PAUSED",
  "CLOSED",
]);

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    channel: conversationChannelEnum("channel").notNull(),
    status: conversationStatusEnum("status").notNull().default("ACTIVE"),
    aiPaused: boolean("ai_paused").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("conversations_organization_lead_channel_uidx").on(
      table.organizationId,
      table.leadId,
      table.channel,
    ),
    index("conversations_organization_id_idx").on(table.organizationId),
    index("conversations_lead_id_idx").on(table.leadId),
  ],
);

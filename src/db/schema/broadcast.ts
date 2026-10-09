import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { leads } from "./leads";
import { organizations } from "./organizations";

export const broadcastChannelEnum = pgEnum("broadcast_channel", ["TELEGRAM"]);
export const broadcastCampaignStatusEnum = pgEnum("broadcast_campaign_status", [
  "DRAFT",
  "PROCESSING",
  "COMPLETED",
  "PARTIALLY_FAILED",
  "FAILED",
  "CANCELLED",
]);
export const broadcastRecipientStatusEnum = pgEnum(
  "broadcast_recipient_status",
  ["PENDING", "SENDING", "SENT", "FAILED", "SKIPPED"],
);

export const messageTemplates = pgTable(
  "message_templates",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    body: text("body").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("message_templates_organization_name_uidx").on(
      table.organizationId,
      table.name,
    ),
  ],
);

export const broadcastCampaigns = pgTable(
  "broadcast_campaigns",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channel: broadcastChannelEnum("channel").notNull(),
    status: broadcastCampaignStatusEnum("status").notNull().default("DRAFT"),
    templateId: text("template_id").references(() => messageTemplates.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    audienceFilters: jsonb("audience_filters").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("broadcast_campaigns_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("broadcast_campaigns_status_idx").on(table.status),
  ],
);

export const broadcastRecipients = pgTable(
  "broadcast_recipients",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => broadcastCampaigns.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    recipientName: text("recipient_name"),
    destination: text("destination"),
    status: broadcastRecipientStatusEnum("status").notNull().default("PENDING"),
    skipReason: text("skip_reason"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    providerMessageId: text("provider_message_id"),
    errorCode: text("error_code"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("broadcast_recipients_campaign_lead_uidx").on(
      table.campaignId,
      table.leadId,
    ),
    index("broadcast_recipients_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),
    index("broadcast_recipients_organization_id_idx").on(table.organizationId),
  ],
);

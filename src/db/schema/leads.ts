import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { telegramConnections } from "./telegram-connections";

export const leadStageEnum = pgEnum("lead_stage", [
  "NEW",
  "QUALIFYING",
  "HOT",
  "WARM",
  "COLD",
  "PAYMENT_PENDING",
  "CONVERTED",
]);

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    telegramConnectionId: text("telegram_connection_id").references(
      () => telegramConnections.id,
      { onDelete: "set null" },
    ),
    telegramUserId: text("telegram_user_id"),
    source: text("source"),
    need: text("need"),
    propertyType: text("property_type"),
    location: text("location"),
    budget: numeric("budget", { precision: 14, scale: 2 }),
    timeline: text("timeline"),
    decisionMaker: boolean("decision_maker"),
    score: integer("score").notNull().default(0),
    stage: leadStageEnum("stage").notNull().default("NEW"),
    summary: text("summary"),
    urgent: boolean("urgent").notNull().default(false),
    handedOff: boolean("handed_off").notNull().default(false),
    broadcastOptedOutAt: timestamp("broadcast_opted_out_at", {
      withTimezone: true,
    }),
    broadcastOptOutReason: text("broadcast_opt_out_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("leads_organization_id_idx").on(table.organizationId),
    index("leads_organization_stage_idx").on(
      table.organizationId,
      table.stage,
    ),
    index("leads_organization_score_idx").on(
      table.organizationId,
      table.score,
    ),
    uniqueIndex("leads_organization_telegram_user_uidx").on(
      table.organizationId,
      table.telegramUserId,
    ),
    index("leads_telegram_connection_id_idx").on(table.telegramConnectionId),
  ],
);

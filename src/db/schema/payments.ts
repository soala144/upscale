import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { leads } from "./leads";

export const paymentTypeEnum = pgEnum("payment_type", [
  "SUBSCRIPTION",
  "CUSTOMER_PURCHASE",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
]);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    type: paymentTypeEnum("type").notNull(),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("NGN"),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id"),
    checkoutId: text("checkout_id"),
    providerReference: text("provider_reference"),
    platformFee: numeric("platform_fee", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payments_organization_id_idx").on(table.organizationId),
    index("payments_lead_id_idx").on(table.leadId),
    index("payments_status_idx").on(table.status),
    uniqueIndex("payments_provider_reference_uidx").on(
      table.provider,
      table.providerAccountId,
      table.providerReference,
    ),
  ],
);

import {
  index,
  pgTable,
  text,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";

import {
  organizations,
  planEnum,
  subscriptionStatusEnum,
} from "./organizations";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    provider: text("provider").notNull(),
    providerSubscriptionId: text("provider_subscription_id"),
    providerReference: text("provider_reference"),
    providerProductId: text("provider_product_id"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("NGN"),
    trialStart: timestamp("trial_start", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }),
    nextPaymentDue: timestamp("next_payment_due", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("subscriptions_organization_id_idx").on(table.organizationId),
    index("subscriptions_provider_subscription_idx").on(
      table.provider,
      table.providerSubscriptionId,
    ),
    index("subscriptions_provider_reference_idx").on(
      table.provider,
      table.providerReference,
    ),
  ],
);

import {
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const bachsWebhookEvents = pgTable(
  "bachs_webhook_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bachs_webhook_events_processed_at_idx").on(table.processedAt)],
);

import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations";

export const knowledgeKindEnum = pgEnum("knowledge_kind", ["PRODUCT", "FAQ"]);

export const knowledgeItems = pgTable(
  "knowledge_items",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: knowledgeKindEnum("kind").notNull(),
    /** Product or service name, or the FAQ question. */
    title: text("title").notNull(),
    /** Product description, or the FAQ answer. */
    content: text("content").notNull(),
    price: numeric("price", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("NGN"),
    available: boolean("available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("knowledge_items_organization_kind_idx").on(
      table.organizationId,
      table.kind,
    ),
  ],
);

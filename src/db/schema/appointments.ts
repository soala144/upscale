import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { leads } from "./leads";
import { organizations } from "./organizations";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);
export const appointmentTypeEnum = pgEnum("appointment_type", [
  "CALL",
  "MEETING",
  "SITE_VISIT",
  "DEMO",
  "FOLLOW_UP",
  "OTHER",
]);

export const appointments = pgTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Deleting a lead detaches the appointment but keeps it for history.
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    leadName: text("lead_name"),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    type: appointmentTypeEnum("type").notNull().default("MEETING"),
    status: appointmentStatusEnum("status").notNull().default("SCHEDULED"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    location: text("location"),
    notes: text("notes"),
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
    index("appointments_organization_starts_idx").on(
      table.organizationId,
      table.startsAt,
    ),
    index("appointments_organization_lead_idx").on(
      table.organizationId,
      table.leadId,
    ),
    index("appointments_assignee_starts_idx").on(
      table.assignedToUserId,
      table.startsAt,
    ),
  ],
);

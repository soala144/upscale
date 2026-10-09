import { z } from "zod";

export const appointmentTypes = [
  "CALL",
  "MEETING",
  "SITE_VISIT",
  "DEMO",
  "FOLLOW_UP",
  "OTHER",
] as const;
export const appointmentStatuses = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type AppointmentType = (typeof appointmentTypes)[number];
export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const MAX_APPOINTMENT_MINUTES = 24 * 60;

const instant = z.string().datetime({ offset: true });

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const baseFields = {
  title: z.string().trim().min(1, "Enter a title.").max(160),
  type: z.enum(appointmentTypes),
  startsAt: instant,
  endsAt: instant,
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidTimeZone, "Unknown time zone."),
  leadId: z.string().min(1).max(100).nullable().optional(),
  assignedToUserId: z.string().min(1).max(100).nullable().optional(),
  location: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  allowConflict: z.boolean().optional(),
};

function refineRange<
  T extends { startsAt?: string; endsAt?: string },
>(schema: z.ZodType<T>) {
  return schema.superRefine((value, context) => {
    if (!value.startsAt || !value.endsAt) return;
    const start = Date.parse(value.startsAt);
    const end = Date.parse(value.endsAt);
    if (end <= start) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "End time must be after the start time.",
      });
    } else if ((end - start) / 60_000 > MAX_APPOINTMENT_MINUTES) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "An appointment cannot be longer than 24 hours.",
      });
    }
  });
}

export const createAppointmentSchema = refineRange(z.object(baseFields));
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = refineRange(
  z
    .object({
      ...baseFields,
      title: baseFields.title.optional(),
      type: baseFields.type.optional(),
      startsAt: baseFields.startsAt.optional(),
      endsAt: baseFields.endsAt.optional(),
      timezone: baseFields.timezone.optional(),
      status: z.enum(appointmentStatuses).optional(),
    })
    .refine((value) => (value.startsAt === undefined) === (value.endsAt === undefined), {
      message: "Provide both start and end time to reschedule.",
      path: ["endsAt"],
    }),
);
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

const terminal: AppointmentStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function isTerminalStatus(status: AppointmentStatus) {
  return terminal.includes(status);
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return from === to || transitions[from].includes(to);
}

/** Cancelled and no-show appointments never block a slot. */
export function occupiesSlot(status: AppointmentStatus) {
  return status === "SCHEDULED" || status === "CONFIRMED";
}

export type TimeRange = { startsAt: Date; endsAt: Date };

/** Half-open interval overlap: back-to-back appointments do not conflict. */
export function rangesOverlap(a: TimeRange, b: TimeRange) {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function findConflicts<
  T extends TimeRange & { id: string; status: AppointmentStatus },
>(candidate: TimeRange & { id?: string }, existing: T[]): T[] {
  return existing.filter(
    (item) =>
      item.id !== candidate.id &&
      occupiesSlot(item.status) &&
      rangesOverlap(candidate, item),
  );
}

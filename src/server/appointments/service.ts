import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, lt, type SQL } from "drizzle-orm";

import { getDatabase } from "@/db";
import { appointments } from "@/db/schema/appointments";
import { user } from "@/db/schema/auth";
import { leads } from "@/db/schema/leads";
import { members } from "@/db/schema/organizations";
import {
  canTransition,
  findConflicts,
  isTerminalStatus,
  type AppointmentStatus,
  type CreateAppointmentInput,
  type UpdateAppointmentInput,
} from "@/lib/appointments/rules";
import { trackEvent } from "@/server/integrations/watchup";

export type AppointmentConflict = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

export class AppointmentError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
    public readonly conflicts?: AppointmentConflict[],
  ) {
    super(message);
    this.name = "AppointmentError";
  }
}

const MAX_LIST = 500;

const appointmentColumns = {
  id: appointments.id,
  title: appointments.title,
  type: appointments.type,
  status: appointments.status,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  timezone: appointments.timezone,
  location: appointments.location,
  notes: appointments.notes,
  leadId: appointments.leadId,
  leadName: leads.name,
  leadNameSnapshot: appointments.leadName,
  assignedToUserId: appointments.assignedToUserId,
  assigneeName: user.name,
  createdAt: appointments.createdAt,
  updatedAt: appointments.updatedAt,
};

function serialize<
  R extends {
    startsAt: Date;
    endsAt: Date;
    createdAt: Date;
    updatedAt: Date;
    leadName: string | null;
    leadNameSnapshot: string | null;
  },
>(row: R) {
  const { leadName, leadNameSnapshot, ...rest } = row;
  return {
    ...rest,
    // Prefer the live lead name; fall back to the snapshot if the lead was removed.
    leadName: leadName ?? leadNameSnapshot ?? null,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function baseQuery() {
  return getDatabase()
    .select(appointmentColumns)
    .from(appointments)
    .leftJoin(leads, eq(leads.id, appointments.leadId))
    .leftJoin(user, eq(user.id, appointments.assignedToUserId));
}

export async function listAppointments(
  organizationId: string,
  filters: {
    from?: Date;
    to?: Date;
    statuses?: AppointmentStatus[];
    assignedToUserId?: string;
    leadId?: string;
  },
) {
  const conditions: Array<SQL | undefined> = [
    eq(appointments.organizationId, organizationId),
  ];
  // Overlap semantics: anything touching [from, to) is in range.
  if (filters.from) conditions.push(gt(appointments.endsAt, filters.from));
  if (filters.to) conditions.push(lt(appointments.startsAt, filters.to));
  if (filters.statuses?.length) {
    conditions.push(inArray(appointments.status, filters.statuses));
  }
  if (filters.assignedToUserId) {
    conditions.push(eq(appointments.assignedToUserId, filters.assignedToUserId));
  }
  if (filters.leadId) conditions.push(eq(appointments.leadId, filters.leadId));

  const rows = await baseQuery()
    .where(and(...conditions))
    .orderBy(asc(appointments.startsAt), asc(appointments.id))
    .limit(MAX_LIST + 1);

  return {
    appointments: rows.slice(0, MAX_LIST).map(serialize),
    truncated: rows.length > MAX_LIST,
  };
}

export async function getAppointment(organizationId: string, appointmentId: string) {
  const [row] = await baseQuery()
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new AppointmentError("Appointment not found", 404);
  return serialize(row);
}

export async function listAssignees(organizationId: string) {
  return getDatabase()
    .select({ id: user.id, name: user.name, role: members.role })
    .from(members)
    .innerJoin(user, eq(user.id, members.userId))
    .where(eq(members.organizationId, organizationId))
    .orderBy(asc(user.name));
}

async function assertLead(organizationId: string, leadId: string) {
  const [lead] = await getDatabase()
    .select({ id: leads.id, name: leads.name })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
    .limit(1);
  if (!lead) throw new AppointmentError("Lead not found", 404);
  return lead;
}

async function assertAssignee(organizationId: string, userId: string) {
  const [member] = await getDatabase()
    .select({ userId: members.userId })
    .from(members)
    .where(
      and(eq(members.organizationId, organizationId), eq(members.userId, userId)),
    )
    .limit(1);
  if (!member) {
    throw new AppointmentError("Assignee must be a member of this organization", 400);
  }
}

/**
 * Conflicts are only detectable per assignee: the data model has no working
 * hours, rooms or resources, so unassigned appointments are never flagged.
 */
async function detectConflicts(
  organizationId: string,
  assignedToUserId: string | null | undefined,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
) {
  if (!assignedToUserId) return [];
  const rows = await getDatabase()
    .select({
      id: appointments.id,
      title: appointments.title,
      status: appointments.status,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, organizationId),
        eq(appointments.assignedToUserId, assignedToUserId),
        inArray(appointments.status, ["SCHEDULED", "CONFIRMED"]),
        gt(appointments.endsAt, startsAt),
        lt(appointments.startsAt, endsAt),
      ),
    );
  return findConflicts({ id: excludeId, startsAt, endsAt }, rows).map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  }));
}

function throwIfConflicts(conflicts: AppointmentConflict[], allow: boolean | undefined) {
  if (conflicts.length && !allow) {
    throw new AppointmentError(
      "This time overlaps another appointment for the same salesperson",
      409,
      conflicts,
    );
  }
}

export async function createAppointment(
  organizationId: string,
  userId: string,
  input: CreateAppointmentInput,
) {
  const lead = input.leadId ? await assertLead(organizationId, input.leadId) : null;
  if (input.assignedToUserId) await assertAssignee(organizationId, input.assignedToUserId);

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  throwIfConflicts(
    await detectConflicts(organizationId, input.assignedToUserId, startsAt, endsAt),
    input.allowConflict,
  );

  const id = randomUUID();
  await getDatabase().insert(appointments).values({
    id,
    organizationId,
    leadId: lead?.id ?? null,
    leadName: lead?.name ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
    title: input.title,
    type: input.type,
    status: "SCHEDULED",
    startsAt,
    endsAt,
    timezone: input.timezone,
    location: input.location || null,
    notes: input.notes || null,
    createdBy: userId,
  });

  trackEvent("appointment.created", {
    organizationId,
    appointmentId: id,
    hasLead: Boolean(lead),
  });
  return getAppointment(organizationId, id);
}

export async function updateAppointment(
  organizationId: string,
  appointmentId: string,
  input: UpdateAppointmentInput,
) {
  const [current] = await getDatabase()
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!current) throw new AppointmentError("Appointment not found", 404);

  const changesDetails =
    input.title !== undefined ||
    input.type !== undefined ||
    input.startsAt !== undefined ||
    input.leadId !== undefined ||
    input.assignedToUserId !== undefined ||
    input.location !== undefined ||
    input.notes !== undefined;
  if (isTerminalStatus(current.status) && changesDetails) {
    throw new AppointmentError(
      `A ${current.status.toLowerCase().replace("_", "-")} appointment can no longer be edited`,
      409,
    );
  }
  if (input.status && !canTransition(current.status, input.status)) {
    throw new AppointmentError(
      `Cannot change an appointment from ${current.status} to ${input.status}`,
      409,
    );
  }

  const nextAssignee =
    input.assignedToUserId === undefined ? current.assignedToUserId : input.assignedToUserId;
  const nextStart = input.startsAt ? new Date(input.startsAt) : current.startsAt;
  const nextEnd = input.endsAt ? new Date(input.endsAt) : current.endsAt;
  const nextStatus = input.status ?? current.status;

  let leadPatch: { leadId: string | null; leadName: string | null } | undefined;
  if (input.leadId !== undefined) {
    if (input.leadId) {
      const lead = await assertLead(organizationId, input.leadId);
      leadPatch = { leadId: lead.id, leadName: lead.name };
    } else {
      leadPatch = { leadId: null, leadName: null };
    }
  }
  if (input.assignedToUserId) await assertAssignee(organizationId, input.assignedToUserId);

  const scheduleChanged =
    input.startsAt !== undefined || input.assignedToUserId !== undefined;
  if (scheduleChanged && (nextStatus === "SCHEDULED" || nextStatus === "CONFIRMED")) {
    throwIfConflicts(
      await detectConflicts(organizationId, nextAssignee, nextStart, nextEnd, appointmentId),
      input.allowConflict,
    );
  }

  const now = new Date();
  const [updated] = await getDatabase()
    .update(appointments)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.startsAt !== undefined && { startsAt: nextStart, endsAt: nextEnd }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.location !== undefined && { location: input.location || null }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
      ...(input.assignedToUserId !== undefined && {
        assignedToUserId: input.assignedToUserId,
      }),
      ...leadPatch,
      ...(input.status !== undefined && { status: input.status }),
      updatedAt: now,
    })
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.organizationId, organizationId),
        // Optimistic guard so a concurrent status change cannot be overwritten.
        eq(appointments.status, current.status),
      ),
    )
    .returning({ id: appointments.id });
  if (!updated) {
    throw new AppointmentError("The appointment changed; reload and try again", 409);
  }

  if (input.status && input.status !== current.status) {
    trackEvent("appointment.status_changed", {
      organizationId,
      appointmentId,
      status: input.status,
    });
  } else if (input.startsAt !== undefined) {
    trackEvent("appointment.rescheduled", { organizationId, appointmentId });
  } else {
    trackEvent("appointment.updated", { organizationId, appointmentId });
  }
  return getAppointment(organizationId, appointmentId);
}

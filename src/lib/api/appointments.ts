import type {
  AppointmentStatus,
  AppointmentType,
} from "@/lib/appointments/rules";

import { apiRequest, jsonBody } from "./client";

export type { AppointmentStatus, AppointmentType };

export type Appointment = {
  id: string;
  title: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location: string | null;
  notes: string | null;
  leadId: string | null;
  leadName: string | null;
  assignedToUserId: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Assignee = { id: string; name: string; role: string };

export type AppointmentInput = {
  title: string;
  type: AppointmentType;
  startsAt: string;
  endsAt: string;
  timezone: string;
  leadId?: string | null;
  assignedToUserId?: string | null;
  location?: string | null;
  notes?: string | null;
  allowConflict?: boolean;
};

export type AppointmentFilters = {
  from?: Date;
  to?: Date;
  statuses?: AppointmentStatus[];
  assignedTo?: string;
  leadId?: string;
};

export const getAppointments = (filters: AppointmentFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from.toISOString());
  if (filters.to) params.set("to", filters.to.toISOString());
  if (filters.statuses?.length) params.set("status", filters.statuses.join(","));
  if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
  if (filters.leadId) params.set("leadId", filters.leadId);
  return apiRequest<{ appointments: Appointment[]; truncated: boolean }>(
    `/api/appointments?${params.toString()}`,
  );
};

export const getAssignees = async () =>
  (await apiRequest<{ assignees: Assignee[] }>("/api/appointments/assignees")).assignees;

export const createAppointment = async (input: AppointmentInput) =>
  (
    await apiRequest<{ appointment: Appointment }>("/api/appointments", {
      method: "POST",
      body: jsonBody(input),
    })
  ).appointment;

export const updateAppointment = async (
  id: string,
  input: Partial<AppointmentInput> & { status?: AppointmentStatus },
) =>
  (
    await apiRequest<{ appointment: Appointment }>(
      `/api/appointments/${encodeURIComponent(id)}`,
      { method: "PATCH", body: jsonBody(input) },
    )
  ).appointment;

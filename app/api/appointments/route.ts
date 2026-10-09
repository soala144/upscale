import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import {
  appointmentStatuses,
  createAppointmentSchema,
  type AppointmentStatus,
} from "@/lib/appointments/rules";
import {
  createAppointment,
  listAppointments,
} from "@/server/appointments/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const GET = trackRequest("api.appointments.list", async (request: Request) => {
  try {
    const { membership } = await requireActiveOrganizationMembership(request);
    const params = new URL(request.url).searchParams;
    const statuses = (params.get("status") ?? "")
      .split(",")
      .filter((value): value is AppointmentStatus =>
        (appointmentStatuses as readonly string[]).includes(value),
      );
    const result = await listAppointments(membership.organizationId, {
      from: parseDate(params.get("from")),
      to: parseDate(params.get("to")),
      statuses,
      assignedToUserId: params.get("assignedTo") || undefined,
      leadId: params.get("leadId") || undefined,
    });
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error, "appointments.list");
  }
});

export const POST = trackRequest("api.appointments.create", async (request: Request) => {
  try {
    const { membership, user } = await requireActiveOrganizationMembership(request);
    const input = createAppointmentSchema.parse(await request.json());
    const appointment = await createAppointment(membership.organizationId, user.id, input);
    return Response.json({ appointment }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "appointments.create");
  }
});

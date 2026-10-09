import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { updateAppointmentSchema } from "@/lib/appointments/rules";
import {
  getAppointment,
  updateAppointment,
} from "@/server/appointments/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export const GET = trackRequest(
  "api.appointments.get",
  async (request: Request, context: Context) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireActiveOrganizationMembership(request);
      return Response.json({ appointment: await getAppointment(membership.organizationId, id) });
    } catch (error) {
      return apiErrorResponse(error, "appointments.get");
    }
  },
);

export const PATCH = trackRequest(
  "api.appointments.update",
  async (request: Request, context: Context) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireActiveOrganizationMembership(request);
      const input = updateAppointmentSchema.parse(await request.json());
      const appointment = await updateAppointment(membership.organizationId, id, input);
      return Response.json({ appointment });
    } catch (error) {
      return apiErrorResponse(error, "appointments.update");
    }
  },
);

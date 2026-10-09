import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { listAssignees } from "@/server/appointments/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

export const GET = trackRequest("api.appointments.assignees", async (request: Request) => {
  try {
    const { membership } = await requireActiveOrganizationMembership(request);
    return Response.json({ assignees: await listAssignees(membership.organizationId) });
  } catch (error) {
    return apiErrorResponse(error, "appointments.assignees");
  }
});

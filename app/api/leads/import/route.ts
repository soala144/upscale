import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { importLeadsSchema, leadInputSchema } from "@/lib/leads/input";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { importLeads } from "@/server/leads/create";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = trackRequest("api.leads.import", async (request: Request) => {
  try {
    const { membership } = await requireActiveOrganizationMembership(request);
    const body = importLeadsSchema.parse(await request.json());
    // Every row is validated again on the server; the browser parse is only a convenience.
    const leads = body.leads.map((row) => leadInputSchema.parse(row));
    return Response.json(await importLeads(membership.organizationId, leads), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "leads.import");
  }
});

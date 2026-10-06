import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { listOrganizationLeads } from "@/server/leads/service";

export const runtime = "nodejs";

export const GET = trackRequest(
  "api.leads.list",
  async (request: Request) => {
    try {
      const { membership } =
        await requireActiveOrganizationMembership(request);
      const leads = await listOrganizationLeads(membership.organizationId);
      return Response.json({ leads });
    } catch (error) {
      return apiErrorResponse(error, "leads.list");
    }
  },
);

import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { leadInputSchema } from "@/lib/leads/input";
import { createManualLead } from "@/server/leads/create";
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

export const POST = trackRequest(
  "api.leads.create",
  async (request: Request) => {
    try {
      const { membership } =
        await requireActiveOrganizationMembership(request);
      const input = leadInputSchema.parse(await request.json());
      const lead = await createManualLead(membership.organizationId, input);
      return Response.json({ lead }, { status: 201 });
    } catch (error) {
      return apiErrorResponse(error, "leads.create");
    }
  },
);

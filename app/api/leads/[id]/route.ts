import {
  requireActiveOrganizationMembership,
} from "@/lib/auth/organization-access";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { getOrganizationLead } from "@/server/leads/service";

export const runtime = "nodejs";

type LeadRouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = trackRequest(
  "api.leads.get",
  async (
    request: Request,
    context: LeadRouteContext,
  ) => {
    try {
      const { id } = await context.params;
      const { membership } =
        await requireActiveOrganizationMembership(request);
      const lead = await getOrganizationLead(membership.organizationId, id);
      if (!lead) {
        return Response.json({ error: "Lead not found" }, { status: 404 });
      }
      return Response.json({ lead });
    } catch (error) {
      return apiErrorResponse(error, "leads.get");
    }
  },
);

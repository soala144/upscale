import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { getCampaignDetail } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

export const GET = trackRequest(
  "api.broadcast.campaigns.get",
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireActiveOrganizationMembership(request);
      const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
      return Response.json(await getCampaignDetail(membership.organizationId, id, page));
    } catch (error) {
      return apiErrorResponse(error, "broadcast.campaigns.get");
    }
  },
);

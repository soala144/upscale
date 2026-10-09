import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { createCampaignSchema } from "@/lib/validation/broadcast";
import { requireBroadcastManager } from "@/server/broadcast/access";
import { createCampaign, listCampaigns } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

export const GET = trackRequest("api.broadcast.campaigns.list", async (request: Request) => {
  try {
    const { membership } = await requireActiveOrganizationMembership(request);
    const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
    return Response.json(await listCampaigns(membership.organizationId, page));
  } catch (error) {
    return apiErrorResponse(error, "broadcast.campaigns.list");
  }
});

export const POST = trackRequest("api.broadcast.campaigns.create", async (request: Request) => {
  try {
    const { membership, user } = await requireBroadcastManager(request);
    const input = createCampaignSchema.parse(await request.json());
    const campaign = await createCampaign(membership.organizationId, user.id, input);
    return Response.json({ campaign }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "broadcast.campaigns.create");
  }
});

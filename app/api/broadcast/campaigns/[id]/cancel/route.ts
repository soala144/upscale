import { requireBroadcastManager } from "@/server/broadcast/access";
import { cancelCampaign } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

export const POST = trackRequest(
  "api.broadcast.campaigns.cancel",
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireBroadcastManager(request);
      await cancelCampaign(membership.organizationId, id);
      return Response.json({ status: "CANCELLED" });
    } catch (error) {
      return apiErrorResponse(error, "broadcast.campaigns.cancel");
    }
  },
);

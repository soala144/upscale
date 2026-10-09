import { after } from "next/server";

import { sendCampaignSchema } from "@/lib/validation/broadcast";
import { requireBroadcastManager } from "@/server/broadcast/access";
import { processCampaign, sendCampaign } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { captureError, trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = trackRequest(
  "api.broadcast.campaigns.send",
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireBroadcastManager(request);
      const input = sendCampaignSchema.parse(await request.json());
      const result = await sendCampaign(membership.organizationId, id, input);
      // Delivery runs after the response so the request never blocks on providers.
      after(async () => {
        try {
          await processCampaign(membership.organizationId, id);
        } catch (error) {
          captureError(error, "broadcast.process");
        }
      });
      return Response.json({ ...result, status: "PROCESSING" }, { status: 202 });
    } catch (error) {
      return apiErrorResponse(error, "broadcast.campaigns.send");
    }
  },
);

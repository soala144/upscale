import { after } from "next/server";

import { requireBroadcastManager } from "@/server/broadcast/access";
import { processCampaign } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { captureError, trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Lets the campaign page nudge delivery forward if the original worker stopped. */
export const POST = trackRequest(
  "api.broadcast.campaigns.process",
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireBroadcastManager(request);
      after(async () => {
        try {
          await processCampaign(membership.organizationId, id);
        } catch (error) {
          captureError(error, "broadcast.process");
        }
      });
      return Response.json({ accepted: true }, { status: 202 });
    } catch (error) {
      return apiErrorResponse(error, "broadcast.campaigns.process");
    }
  },
);

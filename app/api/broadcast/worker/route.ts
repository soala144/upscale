import { createHash, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env/server";
import { processAllActiveCampaigns } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";
export const maxDuration = 60;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/**
 * Optional external trigger (cron) that resumes in-progress campaigns.
 * Disabled unless BROADCAST_WORKER_SECRET is configured.
 */
export const POST = trackRequest("api.broadcast.worker", async (request: Request) => {
  try {
    const secret = getServerEnv().BROADCAST_WORKER_SECRET;
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!secret || !timingSafeEqual(digest(provided), digest(secret))) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    return Response.json(await processAllActiveCampaigns());
  } catch (error) {
    return apiErrorResponse(error, "broadcast.worker");
  }
});

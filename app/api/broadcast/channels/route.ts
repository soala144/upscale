import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { getBroadcastChannels } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

export const GET = trackRequest("api.broadcast.channels", async (request: Request) => {
  try {
    const { membership } = await requireActiveOrganizationMembership(request);
    return Response.json({ channels: await getBroadcastChannels(membership.organizationId) });
  } catch (error) {
    return apiErrorResponse(error, "broadcast.channels");
  }
});

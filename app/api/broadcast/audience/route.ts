import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { audienceFiltersSchema } from "@/lib/broadcast/audience";
import { previewAudience } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

export const POST = trackRequest("api.broadcast.audience", async (request: Request) => {
  try {
    const { membership } = await requireActiveOrganizationMembership(request);
    const filters = audienceFiltersSchema.parse(await request.json());
    return Response.json({ audience: await previewAudience(membership.organizationId, filters) });
  } catch (error) {
    return apiErrorResponse(error, "broadcast.audience");
  }
});

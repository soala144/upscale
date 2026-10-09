import { OrganizationAuthorizationError, requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { diagnoseAiProvider } from "@/server/ai/diagnose";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

/** Owner/admin only: runs one live provider request so misconfiguration is visible without server logs. */
export const POST = trackRequest("api.ai.status", async (request: Request) => {
  try {
    const { membership } = await requireActiveOrganizationMembership(request);
    if (!["owner", "admin"].includes(membership.role)) {
      throw new OrganizationAuthorizationError(403, "Organization administrator access required");
    }
    return Response.json(await diagnoseAiProvider());
  } catch (error) {
    return apiErrorResponse(error, "ai.status");
  }
});

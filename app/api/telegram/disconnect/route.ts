import {
  OrganizationAuthorizationError,
  requireActiveOrganizationMembership,
} from "@/lib/auth/organization-access";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { disconnectTelegram } from "@/server/telegram/service";

export const runtime = "nodejs";

export const POST = trackRequest(
  "api.telegram.disconnect",
  async (request: Request) => {
    try {
      const { membership } =
        await requireActiveOrganizationMembership(request);
      if (!["owner", "admin"].includes(membership.role)) {
        throw new OrganizationAuthorizationError(
          403,
          "Organization administrator access required",
        );
      }

      const result = await disconnectTelegram(membership.organizationId);
      return Response.json(result);
    } catch (error) {
      return apiErrorResponse(error, "telegram.disconnect");
    }
  },
);

import {
  OrganizationAuthorizationError,
  requireActiveOrganizationMembership,
} from "@/lib/auth/organization-access";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { startBachsConnect } from "@/server/organizations/bachs-connect";

export const runtime = "nodejs";

export const POST = trackRequest(
  "api.bachs.connect",
  async (request: Request) => {
    try {
      const { user, membership } =
        await requireActiveOrganizationMembership(request);
      if (!["owner", "admin"].includes(membership.role)) {
        throw new OrganizationAuthorizationError(
          403,
          "Organization administrator access required",
        );
      }

      const result = await startBachsConnect(membership.organizationId, {
        email: user.email,
        name: user.name,
      });

      return Response.json(result, { status: 201 });
    } catch (error) {
      return apiErrorResponse(error, "bachs.connect");
    }
  },
);

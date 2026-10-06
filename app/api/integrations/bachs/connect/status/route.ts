import {
  OrganizationAuthorizationError,
  requireActiveOrganizationMembership,
} from "@/lib/auth/organization-access";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { getBachsConnectStatus } from "@/server/organizations/bachs-connect";

export const runtime = "nodejs";

export const GET = trackRequest(
  "api.bachs.connect.status",
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

      const status = await getBachsConnectStatus(membership.organizationId);
      return Response.json(status);
    } catch (error) {
      return apiErrorResponse(error, "bachs.connect.status");
    }
  },
);

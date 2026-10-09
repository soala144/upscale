import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { getDashboardOverview } from "@/server/dashboard/service";
import { parseRange } from "@/server/dashboard/metrics";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

export const GET = trackRequest(
  "api.dashboard.overview",
  async (request: Request) => {
    try {
      const { membership } =
        await requireActiveOrganizationMembership(request);
      const range = parseRange(new URL(request.url).searchParams.get("range"));
      const overview = await getDashboardOverview(
        membership.organizationId,
        range,
      );
      return Response.json({ overview });
    } catch (error) {
      return apiErrorResponse(error, "dashboard.overview");
    }
  },
);

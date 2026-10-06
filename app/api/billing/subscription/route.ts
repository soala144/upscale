import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { getSubscriptionState } from "@/server/billing/service";

export const runtime = "nodejs";

export const GET = trackRequest(
  "api.billing.subscription",
  async (request: Request) => {
    try {
      const { membership } =
        await requireActiveOrganizationMembership(request);
      const subscription = await getSubscriptionState(
        membership.organizationId,
      );
      return Response.json({ subscription });
    } catch (error) {
      return apiErrorResponse(error, "billing.subscription");
    }
  },
);

import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { listOrganizationPayments } from "@/server/payments/service";

export const runtime = "nodejs";

export const GET = trackRequest(
  "api.payments.list",
  async (request: Request) => {
    try {
      const { membership } =
        await requireActiveOrganizationMembership(request);
      const payments = await listOrganizationPayments(
        membership.organizationId,
      );
      return Response.json({ payments });
    } catch (error) {
      return apiErrorResponse(error, "payments.list");
    }
  },
);

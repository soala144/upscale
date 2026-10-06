import { z } from "zod";

import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { createBillingCheckoutSchema } from "@/lib/validation/billing";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { createSubscriptionCheckout } from "@/server/billing/service";

export const runtime = "nodejs";

export const POST = trackRequest(
  "api.billing.checkout",
  async (request: Request) => {
    try {
      const { user, membership } =
        await requireActiveOrganizationMembership(request);
      const input = createBillingCheckoutSchema.parse(await request.json());
      const result = await createSubscriptionCheckout(
        membership.organizationId,
        input.plan,
        {
          email: user.email || undefined,
          name: user.name || undefined,
        },
      );

      return Response.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }
      return apiErrorResponse(error, "billing.checkout");
    }
  },
);

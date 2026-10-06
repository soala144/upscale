import { z } from "zod";

import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { customerCheckoutSchema } from "@/lib/validation/billing";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { createCustomerCheckout } from "@/server/payments/service";

export const runtime = "nodejs";

export const POST = trackRequest(
  "api.payments.customer_checkout",
  async (request: Request) => {
    try {
      const { membership } =
        await requireActiveOrganizationMembership(request);
      const input = customerCheckoutSchema.parse(await request.json());
      const result = await createCustomerCheckout(
        membership.organizationId,
        input,
      );

      return Response.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }
      return apiErrorResponse(error, "payments.customer_checkout");
    }
  },
);

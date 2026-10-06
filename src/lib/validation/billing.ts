import { z } from "zod";

import { subscriptionPlanIds } from "@/server/billing/pricing";

export const createBillingCheckoutSchema = z
  .object({
    plan: z.enum(subscriptionPlanIds),
  })
  .strict();

export const customerCheckoutSchema = z
  .object({
    leadId: z.string().min(1).max(128),
    amount: z
      .number()
      .finite()
      .positive()
      .max(9_999_999_999.99)
      .refine(
        (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7,
        "must have at most two decimal places",
      ),
  })
  .strict();

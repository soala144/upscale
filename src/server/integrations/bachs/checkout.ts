import "server-only";

import { z } from "zod";

import { BachsApiError, bachsRequest } from "./client";
import { checkoutSessionResponseSchema } from "./types";

const checkoutInputSchema = z.object({
  amount: z
    .number()
    .finite()
    .positive()
    .max(9_999_999_999.99)
    .refine(
      (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7,
      "must have at most two decimal places",
    ),
  currency: z.literal("NGN"),
  reference: z.string().min(1).max(128),
  idempotencyKey: z.string().min(1),
  accountId: z.string().min(1).optional(),
  customer: z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
  }),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  metadata: z.record(z.string(), z.string()),
});

export async function createBachsCheckout(input: z.input<typeof checkoutInputSchema>) {
  const checkout = checkoutInputSchema.parse(input);
  const response = await bachsRequest(
    "/v1/checkout-sessions",
    checkout.idempotencyKey,
    {
      pricing: {
        amount: checkout.amount.toFixed(2),
        currency: checkout.currency,
      },
      reference: checkout.reference,
      customer: checkout.customer,
      success_url: checkout.successUrl,
      cancel_url: checkout.cancelUrl,
      metadata: checkout.metadata,
    },
    (payload) => checkoutSessionResponseSchema.parse(payload),
    { accountId: checkout.accountId },
  );

  const checkoutUrl = new URL(response.checkout_url);
  if (
    checkoutUrl.protocol !== "https:" ||
    !checkoutUrl.hostname.endsWith(".bachs.io")
  ) {
    throw new BachsApiError("Bachs returned an invalid checkout URL", 502);
  }

  return {
    checkoutId: response.checkout_id,
    checkoutUrl: checkoutUrl.toString(),
    reference: response.reference ?? checkout.reference,
  };
}

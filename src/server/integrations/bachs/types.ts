import { z } from "zod";

export const checkoutSessionResponseSchema = z.object({
  checkout_id: z.string().min(1),
  checkout_url: z.string().url(),
  reference: z.string().nullable().optional(),
});

export const bachsWebhookSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  account: z.string().optional(),
  organization_id: z.string().optional(),
  data: z.object({
    checkout_id: z.string().optional(),
    reference: z.string().optional(),
    account: z.string().optional(),
    capability: z.string().optional(),
    status: z.string().optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    currency: z.string().optional(),
  }).passthrough(),
}).passthrough();

export type BachsWebhook = z.infer<typeof bachsWebhookSchema>;

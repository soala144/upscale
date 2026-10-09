import { z } from "zod";

import { audienceFiltersSchema } from "@/lib/broadcast/audience";

export const templateInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  body: z.string().min(1).max(4096),
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Enter a campaign name.").max(120),
  channel: z.literal("TELEGRAM"),
  body: z.string().min(1).max(4096),
  templateId: z.string().min(1).max(100).nullable().optional(),
  filters: audienceFiltersSchema,
});

export const sendCampaignSchema = z.object({
  confirm: z.literal(true),
  excludedLeadIds: z.array(z.string().min(1).max(100)).max(5000).default([]),
});

export const consentSchema = z.object({ optedOut: z.boolean() });

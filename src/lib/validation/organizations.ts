import { z } from "zod";

import { subscriptionPlanIds } from "@/server/billing/pricing";

const organizationName = z.string().trim().min(2).max(100);
const organizationSlug = z
  .string()
  .trim()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const organizationDescription = z.string().trim().max(2_000);
const notificationEmail = z.string().trim().email().max(254);
const agentName = z.string().trim().min(1).max(80);
const agentPrompt = z.string().trim().max(4_000);

export const createOrganizationSchema = z
  .object({
    name: organizationName,
    slug: organizationSlug,
    plan: z.enum(subscriptionPlanIds),
    industry: z.string().trim().min(1).max(80).optional(),
    description: organizationDescription.optional(),
    notificationEmail: notificationEmail.optional(),
  })
  .strict();

export const updateOrganizationSchema = z
  .object({
    name: organizationName.optional(),
    slug: organizationSlug.optional(),
    industry: z.string().trim().min(1).max(80).nullable().optional(),
    description: organizationDescription.nullable().optional(),
    notificationEmail: notificationEmail.nullable().optional(),
    agentName: agentName.optional(),
    agentPrompt: agentPrompt.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one organization field must be provided",
  });

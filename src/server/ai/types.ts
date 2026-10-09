import { z } from "zod";

export const qualificationSchema = z.object({
  need: z.string().max(500).nullable(),
  budget: z.number().finite().nonnegative().nullable(),
  location: z.string().max(300).nullable(),
  timeline: z.string().max(300).nullable(),
  decision_maker: z.boolean().nullable(),
});

export const qualificationResponseSchema = z.object({
  reply: z.string().min(1).max(4_000),
  qualification: qualificationSchema,
  summary: z.string().max(2_000),
  human_requested: z.boolean(),
  handoff_required: z.boolean(),
});

export type QualificationResponse = z.infer<
  typeof qualificationResponseSchema
>;

export type ConversationHistoryItem = {
  role: "USER" | "ASSISTANT" | "HUMAN";
  content: string;
};

export type LeadContext = {
  /** Customer display name (from Telegram or the enquiry form), if known. */
  name?: string | null;
  need: string | null;
  budget: string | null;
  location: string | null;
  timeline: string | null;
  decisionMaker: boolean | null;
};

export type OrganizationContext = {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  agentName: string;
  agentPrompt: string | null;
};

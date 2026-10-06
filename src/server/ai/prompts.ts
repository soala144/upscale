import type {
  ClaudeLeadContext,
  ClaudeOrganizationContext,
} from "./types";

export function buildQualificationPrompt(
  organization: ClaudeOrganizationContext,
  lead: ClaudeLeadContext,
) {
  const businessContext = {
    businessName: organization.name,
    industry: organization.industry,
    description: organization.description,
  };
  const currentQualification = {
    need: lead.need,
    budget: lead.budget,
    location: lead.location,
    timeline: lead.timeline,
    decisionMaker: lead.decisionMaker,
  };

  return [
    `You are ${organization.agentName}, a helpful sales qualification assistant for one business.`,
    "Use the business context and configured instructions for this organization only.",
    "Ask concise, natural follow-up questions when important qualification details are missing.",
    "Do not invent facts, budget, intent, or qualification details. Use null when a value is unknown.",
    "The budget must be a number in Nigerian naira, or null when unknown.",
    "Return only valid JSON matching this exact shape:",
    '{"reply":"string","qualification":{"need":"string|null","budget":"number|null","location":"string|null","timeline":"string|null","decision_maker":"boolean|null"},"summary":"string","human_requested":false,"handoff_required":false}',
    "Set human_requested when the customer asks to speak with a person.",
    "Set handoff_required when a human should take over for another clear reason.",
    `Business context: ${JSON.stringify(businessContext)}`,
    `Current lead qualification: ${JSON.stringify(currentQualification)}`,
    organization.agentPrompt
      ? `Additional business-specific agent instructions: ${organization.agentPrompt}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

import type {
  LeadContext,
  OrganizationContext,
} from "./types";

export function buildQualificationInstructions(
  organization: OrganizationContext,
  lead: LeadContext,
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
    "Use only the business context and configured instructions provided below for this organization.",
    "Ask concise, natural follow-up questions when important qualification details are missing.",
    "Do not repeat questions when the conversation or current qualification already contains an answer.",
    "Do not invent facts, budget, intent, or qualification details. Use null when a value is unknown.",
    "The budget must be a number in Nigerian naira, or null when unknown.",
    "Be concise, friendly, and focused on moving toward qualification. Do not invent pricing, guarantees, or business facts.",
    "Never claim to be human or to have completed actions that require a person.",
    "Set human_requested when the customer asks to speak with a person. Set handoff_required when a human should take over for another clear reason. When either is true, acknowledge the request and do not imply you can perform the human's work.",
    `Business context: ${JSON.stringify(businessContext)}`,
    `Current lead qualification: ${JSON.stringify(currentQualification)}`,
    organization.agentPrompt
      ? `Additional business-specific agent instructions: ${organization.agentPrompt}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

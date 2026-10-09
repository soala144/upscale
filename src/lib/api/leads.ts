import { apiRequest } from "./client";

export type LeadStage =
  | "NEW"
  | "QUALIFYING"
  | "HOT"
  | "WARM"
  | "COLD"
  | "PAYMENT_PENDING"
  | "CONVERTED";

export type Lead = {
  id: string;
  organizationId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramConnectionId: string | null;
  telegramUserId: string | null;
  source: string | null;
  need: string | null;
  propertyType: string | null;
  location: string | null;
  budget: string | null;
  timeline: string | null;
  decisionMaker: boolean | null;
  score: number;
  stage: LeadStage;
  summary: string | null;
  urgent: boolean;
  handedOff: boolean;
  notes: string | null;
  broadcastOptedOutAt: string | null;
  broadcastOptOutReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "HUMAN";
  content: string;
  channel: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  organizationId: string;
  leadId: string;
  channel: "TELEGRAM" | "WEB";
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  aiPaused: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

export const getLeads = async () =>
  (await apiRequest<{ leads: Lead[] }>("/api/leads")).leads;

export const getLead = async (id: string) =>
  (await apiRequest<{ lead: Lead }>(`/api/leads/${encodeURIComponent(id)}`)).lead;

export const getLeadConversation = async (id: string) => {
  const result = await apiRequest<{ conversation: Conversation }>(
    `/api/leads/${encodeURIComponent(id)}/conversation`,
  );
  return result.conversation;
};

export const setConversationAiPaused = (leadId: string, aiPaused: boolean) =>
  apiRequest<{ aiPaused: boolean }>(
    `/api/leads/${encodeURIComponent(leadId)}/conversation`,
    { method: "PATCH", body: JSON.stringify({ aiPaused }) },
  );

export const sendHumanReply = (leadId: string, content: string) =>
  apiRequest<{ id: string; aiPaused: boolean }>(
    `/api/leads/${encodeURIComponent(leadId)}/conversation/messages`,
    { method: "POST", body: JSON.stringify({ content }) },
  );

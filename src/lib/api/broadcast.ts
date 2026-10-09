import type { AudienceFilters, IneligibleReason } from "@/lib/broadcast/audience";

import { apiRequest, jsonBody } from "./client";

export type CampaignStatus =
  | "DRAFT"
  | "PROCESSING"
  | "COMPLETED"
  | "PARTIALLY_FAILED"
  | "FAILED"
  | "CANCELLED";

export type RecipientStatus = "PENDING" | "SENDING" | "SENT" | "FAILED" | "SKIPPED";

export type CampaignCounts = {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type Channel = {
  channel: "TELEGRAM";
  label: string;
  available: boolean;
  detail: string;
};

export type Template = { id: string; name: string; body: string; updatedAt: string };

export type CampaignSummary = {
  id: string;
  name: string;
  channel: "TELEGRAM";
  status: CampaignStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  counts: CampaignCounts;
};

export type CampaignRecipient = {
  id: string;
  leadId: string | null;
  name: string | null;
  status: RecipientStatus;
  skipReason: string | null;
  errorCode: string | null;
  attempts: number;
  providerMessageId: string | null;
  sentAt: string | null;
};

export type AudiencePreview = {
  total: number;
  eligible: number;
  ineligible: Record<IneligibleReason, number>;
  overflow: boolean;
  maxRecipients: number;
  leads: Array<{
    id: string;
    name: string | null;
    stage: string;
    score: number;
    eligible: boolean;
    reason: IneligibleReason | null;
  }>;
};

export const getChannels = async () =>
  (await apiRequest<{ channels: Channel[] }>("/api/broadcast/channels")).channels;

export const getTemplates = async () =>
  (await apiRequest<{ templates: Template[] }>("/api/broadcast/templates")).templates;

export const saveTemplate = (input: { id?: string; name: string; body: string }) =>
  input.id
    ? apiRequest(`/api/broadcast/templates/${encodeURIComponent(input.id)}`, {
        method: "PATCH",
        body: jsonBody({ name: input.name, body: input.body }),
      })
    : apiRequest("/api/broadcast/templates", {
        method: "POST",
        body: jsonBody({ name: input.name, body: input.body }),
      });

export const deleteTemplate = (id: string) =>
  apiRequest(`/api/broadcast/templates/${encodeURIComponent(id)}`, { method: "DELETE" });

export const previewAudience = async (filters: AudienceFilters) =>
  (
    await apiRequest<{ audience: AudiencePreview }>("/api/broadcast/audience", {
      method: "POST",
      body: jsonBody(filters),
    })
  ).audience;

export const getCampaigns = (page = 1) =>
  apiRequest<{ total: number; page: number; pageSize: number; campaigns: CampaignSummary[] }>(
    `/api/broadcast/campaigns?page=${page}`,
  );

export const getCampaign = (id: string, page = 1) =>
  apiRequest<{
    campaign: {
      id: string;
      name: string;
      channel: "TELEGRAM";
      status: CampaignStatus;
      body: string;
      createdAt: string;
      startedAt: string | null;
      completedAt: string | null;
    };
    counts: CampaignCounts;
    recipients: CampaignRecipient[];
    page: number;
    pageSize: number;
  }>(`/api/broadcast/campaigns/${encodeURIComponent(id)}?page=${page}`);

export const createCampaign = async (input: {
  name: string;
  body: string;
  templateId: string | null;
  filters: AudienceFilters;
}) =>
  (
    await apiRequest<{ campaign: { id: string } }>("/api/broadcast/campaigns", {
      method: "POST",
      body: jsonBody({ ...input, channel: "TELEGRAM" }),
    })
  ).campaign;

export const sendCampaign = (id: string, excludedLeadIds: string[]) =>
  apiRequest<{ queued: number; skipped: number }>(
    `/api/broadcast/campaigns/${encodeURIComponent(id)}/send`,
    { method: "POST", body: jsonBody({ confirm: true, excludedLeadIds }) },
  );

export const cancelCampaign = (id: string) =>
  apiRequest(`/api/broadcast/campaigns/${encodeURIComponent(id)}/cancel`, { method: "POST" });

export const nudgeCampaign = (id: string) =>
  apiRequest(`/api/broadcast/campaigns/${encodeURIComponent(id)}/process`, { method: "POST" });

export const setLeadBroadcastConsent = (leadId: string, optedOut: boolean) =>
  apiRequest<{ optedOut: boolean }>(
    `/api/leads/${encodeURIComponent(leadId)}/broadcast-consent`,
    { method: "PATCH", body: jsonBody({ optedOut }) },
  );

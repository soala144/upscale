import { apiRequest } from "./client";

export type BachsStatus = {
  accountId: string | null;
  status: "NOT_CONNECTED" | "ONBOARDING" | "READY" | "CONNECTED";
};

export type BachsConnectResult = {
  accountId: string;
  status: "ONBOARDING" | "READY";
  capabilities: {
    ngnCardCollection: string;
    bankTransfer: string;
  };
  onboardingUrl: string | null;
};

export const getBachsStatus = () =>
  apiRequest<BachsStatus>("/api/integrations/bachs/connect/status");

export const connectBachs = () =>
  apiRequest<BachsConnectResult>("/api/integrations/bachs/connect", {
    method: "POST",
  });

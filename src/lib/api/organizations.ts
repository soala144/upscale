import { apiRequest, jsonBody } from "./client";

export type Plan = "BASIC" | "GROWTH" | "SCALE";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  description: string | null;
  plan: Plan;
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  agentName: string;
  agentPrompt: string | null;
  notificationEmail: string | null;
  bachsAccountStatus: string | null;
  role?: "owner" | "admin" | "member";
  createdAt: string;
  updatedAt: string;
  onboarding?: {
    steps: { key: string; status: "complete" | "pending" }[];
    currentStep: string;
  };
};

export type CreateOrganizationInput = {
  name: string;
  slug: string;
  plan: Plan;
  industry?: string;
  description?: string;
  notificationEmail?: string;
};

export type UpdateOrganizationInput = Partial<
  Pick<
    Organization,
    | "name"
    | "slug"
    | "industry"
    | "description"
    | "notificationEmail"
    | "agentName"
    | "agentPrompt"
  >
>;

export const createOrganization = (input: CreateOrganizationInput) =>
  apiRequest<Organization>("/api/organizations", {
    method: "POST",
    body: jsonBody(input),
  });

export async function getOrganization(id: string) {
  const result = await apiRequest<Organization>(`/api/organizations/${encodeURIComponent(id)}`);
  return result;
}

export const updateOrganization = (id: string, input: UpdateOrganizationInput) =>
  apiRequest<Organization>(`/api/organizations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: jsonBody(input),
  });

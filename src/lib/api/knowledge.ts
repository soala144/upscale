import type { KnowledgeItemInput } from "@/lib/validation/knowledge";

import { apiRequest, jsonBody } from "./client";

export type KnowledgeItem = {
  id: string;
  kind: "PRODUCT" | "FAQ";
  title: string;
  content: string;
  price: string | null;
  currency: string;
  available: boolean;
  updatedAt: string;
};

export const getKnowledge = async () =>
  (await apiRequest<{ items: KnowledgeItem[] }>("/api/knowledge")).items;

export const saveKnowledge = (input: KnowledgeItemInput, id?: string) =>
  id
    ? apiRequest(`/api/knowledge/${encodeURIComponent(id)}`, { method: "PATCH", body: jsonBody(input) })
    : apiRequest("/api/knowledge", { method: "POST", body: jsonBody(input) });

export const deleteKnowledge = (id: string) =>
  apiRequest(`/api/knowledge/${encodeURIComponent(id)}`, { method: "DELETE" });

export const importKnowledge = (items: KnowledgeItemInput[]) =>
  apiRequest<{ created: number }>("/api/knowledge/import", { method: "POST", body: jsonBody({ items }) });

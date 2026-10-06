import { apiRequest } from "./client";

export type Health = {
  status: "ok" | "error";
  service: "upscale";
  database: "ok" | "unavailable";
  timestamp: string;
};

export const getHealth = () => apiRequest<Health>("/api/health");

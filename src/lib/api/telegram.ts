import { apiRequest, jsonBody } from "./client";

export type TelegramConnection = {
  id: string;
  botId: string;
  botUsername: string;
  botName: string | null;
  status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  connected: boolean;
};

export const getTelegramStatus = () =>
  apiRequest<{ connection: TelegramConnection | null }>("/api/telegram/status");

export const connectTelegram = (botToken: string) =>
  apiRequest<{ connection: Omit<TelegramConnection, "connected"> }>(
    "/api/telegram/connect",
    { method: "POST", body: jsonBody({ botToken }) },
  );

export const disconnectTelegram = () =>
  apiRequest<{ status: "DISCONNECTED" }>("/api/telegram/disconnect", {
    method: "POST",
  });

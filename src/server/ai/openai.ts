import "server-only";

import OpenAI from "openai";

import { resolveAiConfig } from "@/lib/ai-config";
import { getServerEnv } from "@/lib/env/server";

let client: OpenAI | undefined;

export class OpenAIConfigurationError extends Error {
  constructor() {
    super("OpenAI is not configured: OPENAI_API_KEY is missing");
    this.name = "OpenAIConfigurationError";
  }
}

export function getOpenAIClient(): OpenAI {
  if (client) {
    return client;
  }

  const env = getServerEnv();
  const { apiKey, baseURL } = resolveAiConfig({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_MODEL,
  });
  if (!apiKey) {
    throw new OpenAIConfigurationError();
  }

  client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    timeout: 20_000,
    maxRetries: 1,
    fetch: (input, init) => globalThis.fetch(input, init),
  });
  return client;
}

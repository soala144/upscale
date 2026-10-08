import "server-only";

import OpenAI from "openai";

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

  const apiKey = getServerEnv().OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAIConfigurationError();
  }

  client = new OpenAI({
    apiKey,
    timeout: 20_000,
    maxRetries: 1,
    fetch: (input, init) => globalThis.fetch(input, init),
  });
  return client;
}

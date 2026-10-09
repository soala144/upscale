import "server-only";

import { APIError } from "openai";

import { resolveAiConfig } from "@/lib/ai-config";
import { getServerEnv } from "@/lib/env/server";

import { getOpenAIClient, OpenAIConfigurationError } from "./openai";

/**
 * Makes one tiny live request and reports where it went and how it was answered.
 * Only the provider host, model, status and error code are returned: never the
 * key or the provider's message, which can contain a masked key.
 */
export async function diagnoseAiProvider() {
  const env = getServerEnv();
  const config = resolveAiConfig({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_MODEL,
  });
  const host = config.baseURL ? new URL(config.baseURL).host : "api.openai.com";
  const base = { host, model: config.model, keyConfigured: Boolean(config.apiKey) };

  try {
    await getOpenAIClient().responses.create({
      model: config.model,
      input: "ping",
      max_output_tokens: 64,
      store: false,
    });
    return { ...base, ok: true as const };
  } catch (error) {
    if (error instanceof OpenAIConfigurationError) {
      return { ...base, ok: false as const, status: null, code: "KEY_MISSING" };
    }
    if (error instanceof APIError) {
      return { ...base, ok: false as const, status: error.status ?? null, code: error.code ?? error.type ?? null };
    }
    return { ...base, ok: false as const, status: null, code: "NETWORK_OR_TIMEOUT" };
  }
}

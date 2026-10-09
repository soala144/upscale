export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-20b";
const OPENAI_DEFAULT_MODEL = "gpt-4.1-mini";

/**
 * Resolves the AI provider settings. A Groq key (gsk_...) selects Groq's
 * OpenAI-compatible endpoint and a Groq model unless they are set explicitly,
 * so a missing OPENAI_BASE_URL cannot send a Groq key to OpenAI.
 */
export function resolveAiConfig(env: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}) {
  const isGroq = Boolean(env.apiKey?.startsWith("gsk_"));
  const model = env.model?.trim();
  return {
    apiKey: env.apiKey,
    baseURL: env.baseUrl || (isGroq ? GROQ_BASE_URL : undefined),
    // gpt-4.1-mini is the app default; it does not exist on Groq.
    model:
      model && !(isGroq && model === OPENAI_DEFAULT_MODEL)
        ? model
        : isGroq
          ? GROQ_DEFAULT_MODEL
          : OPENAI_DEFAULT_MODEL,
  };
}

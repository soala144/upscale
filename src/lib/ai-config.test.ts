import assert from "node:assert/strict";
import test from "node:test";

import { resolveAiConfig } from "./ai-config";

test("a Groq key selects Groq's endpoint and model when nothing else is set", () => {
  const config = resolveAiConfig({ apiKey: "gsk_abc", model: "gpt-4.1-mini" });
  assert.equal(config.baseURL, "https://api.groq.com/openai/v1");
  assert.equal(config.model, "openai/gpt-oss-20b");
});

test("explicit base URL and model always win", () => {
  const config = resolveAiConfig({ apiKey: "gsk_abc", baseUrl: "https://proxy.example/v1", model: "openai/gpt-oss-120b" });
  assert.equal(config.baseURL, "https://proxy.example/v1");
  assert.equal(config.model, "openai/gpt-oss-120b");
});

test("an OpenAI key keeps the OpenAI defaults", () => {
  const config = resolveAiConfig({ apiKey: "sk-proj-abc" });
  assert.equal(config.baseURL, undefined);
  assert.equal(config.model, "gpt-4.1-mini");
});

import assert from "node:assert/strict";
import test from "node:test";

import { generateQualificationReply } from "./qualification";

process.env.OPENAI_API_KEY = "test-openai-key";
process.env.DATABASE_URL = "postgres://localhost/upscale-test";
process.env.BETTER_AUTH_SECRET = "test-better-auth-secret-that-is-long-enough";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.TELEGRAM_BOT_TOKEN_ENCRYPTION_KEY = "a".repeat(64);

const input = {
  organization: {
    id: "org-test",
    name: "Aster Homes",
    industry: "Real estate",
    description: "Residential property sales",
    agentName: "Helen",
    agentPrompt: "Focus on homes near the city centre.",
  },
  lead: {
    need: null,
    budget: null,
    location: null,
    timeline: null,
    decisionMaker: null,
  },
  history: [{ role: "USER" as const, content: "I need a home in Lagos." }],
};

function openAIResponse(output: unknown) {
  return Response.json({
    id: "resp_test",
    object: "response",
    created_at: 1_759_843_200,
    status: "completed",
    model: "gpt-4.1-mini",
    output: [
      {
        id: "msg_test",
        type: "message",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            annotations: [],
            text: JSON.stringify(output),
          },
        ],
      },
    ],
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
    },
  });
}

test("sends tenant-specific context and validates structured OpenAI output", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return openAIResponse({
      reply: "What type of home are you looking for?",
      qualification: {
        need: "A home",
        budget: null,
        location: "Lagos",
        timeline: null,
        decision_maker: null,
      },
      summary: "Looking for a home in Lagos.",
      human_requested: false,
      handoff_required: false,
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await generateQualificationReply(input);

  assert.equal(result.usedFallback, false);
  assert.equal(result.result.qualification.location, "Lagos");
  assert.equal(requestBody?.model, "gpt-4.1-mini");
  assert.equal(requestBody?.store, false);
  assert.match(String(requestBody?.instructions), /Aster Homes/);
  assert.match(String(requestBody?.instructions), /city centre/);
  assert.doesNotMatch(JSON.stringify(requestBody), /Business B/);
  const text = requestBody?.text as
    | { format?: { type?: string } }
    | undefined;
  assert.equal(text?.format?.type, "json_schema");
});

test("preserves unknown qualification fields and identifies a human handoff", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    openAIResponse({
      reply: "I’ll ask a member of the team to join and help you.",
      qualification: {
        need: null,
        budget: null,
        location: null,
        timeline: null,
        decision_maker: null,
      },
      summary: "Customer requested a person.",
      human_requested: true,
      handoff_required: true,
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await generateQualificationReply(input);

  assert.equal(result.usedFallback, false);
  assert.equal(result.result.qualification.need, null);
  assert.equal(result.result.qualification.budget, null);
  assert.equal(result.result.human_requested, true);
  assert.equal(result.result.handoff_required, true);
});

test("uses a safe fallback when OpenAI output cannot be parsed", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => openAIResponse({ reply: "Invalid shape" });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await generateQualificationReply(input);

  assert.equal(result.usedFallback, true);
  assert.match(result.result.reply, /try again shortly/);
  assert.equal(result.result.qualification.budget, null);
});

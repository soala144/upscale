import assert from "node:assert/strict";
import test from "node:test";

import { generateQualificationReply } from "./claude";

process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
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

function anthropicResponse(text: string) {
  return Response.json({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
    },
  });
}

test("sends tenant-specific context and parses a valid Claude response", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return anthropicResponse(
      JSON.stringify({
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
      }),
    );
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await generateQualificationReply(input);

  assert.equal(result.usedFallback, false);
  assert.equal(result.result.qualification.location, "Lagos");
  assert.match(String(requestBody?.system), /Aster Homes/);
  assert.match(String(requestBody?.system), /city centre/);
});

test("uses a safe fallback when Claude returns invalid structured data", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => anthropicResponse("not valid JSON");
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await generateQualificationReply(input);

  assert.equal(result.usedFallback, true);
  assert.match(result.result.reply, /try again shortly/);
  assert.equal(result.result.qualification.budget, null);
});

import assert from "node:assert/strict";
import test from "node:test";

import { generateQualificationReply } from "./qualification";

delete process.env.OPENAI_API_KEY;
process.env.DATABASE_URL = "postgres://localhost/upscale_test";
process.env.BETTER_AUTH_SECRET = "test-better-auth-secret-that-is-long-enough";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.TELEGRAM_BOT_TOKEN_ENCRYPTION_KEY = "a".repeat(64);

test("returns a safe response when OpenAI is not configured", async () => {
  const result = await generateQualificationReply({
    organization: {
      id: "org-test",
      name: "Aster Homes",
      industry: "Real estate",
      description: "Residential property sales",
      agentName: "Helen",
      agentPrompt: null,
    },
    lead: {
      need: null,
      budget: null,
      location: null,
      timeline: null,
      decisionMaker: null,
    },
    history: [{ role: "USER", content: "I need a home." }],
  });

  assert.equal(result.usedFallback, true);
  assert.match(result.result.reply, /try again shortly/);
  assert.equal(result.result.human_requested, false);
  assert.equal(result.result.handoff_required, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { buildQualificationInstructions } from "./prompts";
import { qualificationResponseSchema } from "./types";

const lead = {
  need: null,
  budget: null,
  location: null,
  timeline: null,
  decisionMaker: null,
};

test("qualification prompt contains only the current organization's context", () => {
  const prompt = buildQualificationInstructions(
    {
      id: "org-a",
      name: "Aster Homes",
      industry: "Real estate",
      description: "Residential property sales",
      agentName: "Helen",
      agentPrompt: "Focus on homes near the city centre.",
    },
    lead,
  );

  assert.match(prompt, /Aster Homes/);
  assert.match(prompt, /Focus on homes near the city centre/);
  assert.doesNotMatch(prompt, /Business B/);
});

test("qualification response schema enforces the structured response shape", () => {
  const parsed = qualificationResponseSchema.safeParse({
    reply: "What kind of home are you looking for?",
    qualification: {
      need: "A two-bedroom home",
      budget: 25_000_000,
      location: "Lagos",
      timeline: null,
      decision_maker: true,
    },
    summary: "Looking for a two-bedroom home in Lagos.",
    human_requested: false,
    handoff_required: false,
  });

  assert.equal(parsed.success, true);
  assert.equal(
    qualificationResponseSchema.safeParse({
      reply: "Interested",
      qualification: {
        need: null,
        budget: -1,
        location: null,
        timeline: null,
        decision_maker: null,
      },
      summary: "",
      human_requested: false,
      handoff_required: false,
    }).success,
    false,
  );
});

test("sales prompt enforces plain text, short replies, no catalogue dumps and uses the customer's name", () => {
  const org = { id: "o", name: "Shop", industry: null, description: null, agentName: "Helen", agentPrompt: null };
  const base = { need: null, budget: null, location: null, timeline: null, decisionMaker: null };
  const named = buildQualificationInstructions(org, { ...base, name: "Tomiwa Adeyemi" });
  assert.match(named, /customer's name is Tomiwa\b/);
  assert.doesNotMatch(named, /Adeyemi/);
  assert.match(named, /Plain text only/);
  assert.match(named, /Do not dump the whole catalogue/);
  assert.match(named, /one question at a time/i);
  assert.match(buildQualificationInstructions(org, base), /Do not guess one/);
});

test("prompt does not let broadcast promotions in the chat history count as real offers", () => {
  const org = { id: "o", name: "Shop", industry: null, description: null, agentName: "Helen", agentPrompt: null };
  const base = { need: null, budget: null, location: null, timeline: null, decisionMaker: null };
  assert.match(buildQualificationInstructions(org, base), /broadcast announcements/);
});

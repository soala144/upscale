import assert from "node:assert/strict";
import test from "node:test";

import { classifyLeadScore, scoreLead } from "./scoreLead";

const completeLead = {
  need: "Looking for a two-bedroom home",
  budget: "25000000",
  timeline: "Within three months",
  decisionMaker: true,
};

test("scores only the qualification facts present on a lead", () => {
  assert.deepEqual(scoreLead(completeLead), {
    score: 100,
    stage: "HOT",
    breakdown: {
      needClarity: 25,
      budget: 25,
      timeline: 25,
      decisionMaker: 25,
    },
  });
  assert.equal(
    scoreLead({ ...completeLead, budget: null, decisionMaker: false }).score,
    50,
  );
  assert.equal(
    scoreLead({
      need: null,
      budget: null,
      timeline: " ",
      decisionMaker: null,
    }).stage,
    "COLD",
  );
});

test("classifies exactly at the specified score bands", () => {
  assert.equal(classifyLeadScore(39), "COLD");
  assert.equal(classifyLeadScore(40), "WARM");
  assert.equal(classifyLeadScore(69), "WARM");
  assert.equal(classifyLeadScore(70), "HOT");
  assert.equal(
    scoreLead({
      need: "A home",
      budget: "1000",
      timeline: null,
      decisionMaker: null,
    }).stage,
    "WARM",
  );
  assert.equal(
    scoreLead({
      need: "A home",
      budget: "1000",
      timeline: "Soon",
      decisionMaker: true,
    }).stage,
    "HOT",
  );
});

test("ignores missing, non-positive, and non-finite budgets", () => {
  for (const budget of [null, "", "0", "-1", "NaN", "Infinity"]) {
    assert.equal(
      scoreLead({
        need: null,
        budget,
        timeline: null,
        decisionMaker: null,
      }).breakdown.budget,
      0,
    );
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  audienceFiltersSchema,
  evaluateEligibility,
  isValidTelegramChatId,
} from "./audience";

const base = { telegramUserId: "12345", telegramConnectionId: "conn", broadcastOptedOutAt: null };

test("eligible lead passes", () => {
  assert.equal(evaluateEligibility(base, "conn"), null);
});

test("opted-out leads are excluded even with a valid destination", () => {
  assert.equal(evaluateEligibility({ ...base, broadcastOptedOutAt: new Date() }, "conn"), "OPTED_OUT");
});

test("invalid destinations are excluded", () => {
  for (const id of [null, "", "abc", "-100123", "0", "12.5", "9".repeat(20)]) {
    assert.equal(isValidTelegramChatId(id), false, String(id));
    assert.equal(evaluateEligibility({ ...base, telegramUserId: id }, "conn"), "NO_DESTINATION");
  }
});

test("leads from another bot or with no connected bot are excluded", () => {
  assert.equal(evaluateEligibility(base, "other"), "NOT_CONNECTED");
  assert.equal(evaluateEligibility(base, null), "NOT_CONNECTED");
});

test("opt-out takes precedence over other reasons", () => {
  assert.equal(evaluateEligibility({ ...base, telegramUserId: null, broadcastOptedOutAt: new Date() }, "conn"), "OPTED_OUT");
});

test("filter schema validates ranges and stages", () => {
  assert.ok(audienceFiltersSchema.safeParse({ stages: ["HOT"], scoreMin: 40, scoreMax: 90 }).success);
  assert.equal(audienceFiltersSchema.safeParse({ scoreMin: 90, scoreMax: 40 }).success, false);
  assert.equal(audienceFiltersSchema.safeParse({ stages: ["BOGUS"] }).success, false);
  assert.equal(audienceFiltersSchema.safeParse({ scoreMax: 101 }).success, false);
  assert.equal(
    audienceFiltersSchema.safeParse({ createdFrom: "2026-02-01T00:00:00Z", createdTo: "2026-01-01T00:00:00Z" }).success,
    false,
  );
});

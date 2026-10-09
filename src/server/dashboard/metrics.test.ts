import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStageCounts,
  chartWindow,
  conversionRate,
  fillDailySeries,
  parseRange,
  percentage,
  qualificationRate,
  qualifiedLeads,
  rangeStart,
  totalLeads,
} from "./metrics";

const counts = buildStageCounts([
  { stage: "NEW", count: 4 },
  { stage: "HOT", count: "3" },
  { stage: "WARM", count: 2 },
  { stage: "COLD", count: 5 },
  { stage: "PAYMENT_PENDING", count: 1 },
  { stage: "CONVERTED", count: 5 },
  { stage: "UNKNOWN", count: 99 },
]);

test("totals count every known stage exactly once and ignore unknown rows", () => {
  assert.equal(totalLeads(counts), 20);
  assert.equal(counts.QUALIFYING, 0);
});

test("qualified = HOT + WARM + PAYMENT_PENDING + CONVERTED", () => {
  assert.equal(qualifiedLeads(counts), 11);
  assert.equal(qualificationRate(counts), 55);
});

test("conversion rate is converted / all cohort leads, rounded to one decimal", () => {
  assert.equal(conversionRate(counts), 25);
  assert.equal(percentage(1, 3), 33.3);
});

test("empty data yields null rates, not zero", () => {
  const empty = buildStageCounts([]);
  assert.equal(totalLeads(empty), 0);
  assert.equal(conversionRate(empty), null);
  assert.equal(qualificationRate(empty), null);
});

test("range parsing and boundaries", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  assert.equal(parseRange("7d"), "7d");
  assert.equal(parseRange("junk"), "30d");
  assert.equal(rangeStart("all", now), null);
  assert.equal(rangeStart("7d", now)?.toISOString(), "2026-10-02T12:00:00.000Z");
  assert.equal(chartWindow("all", now).start.toISOString(), "2026-07-11T12:00:00.000Z");
});

test("daily series zero-fills gaps and covers both end days", () => {
  const series = fillDailySeries(
    [{ day: "2026-10-07", count: 2 }, { day: "2026-10-09", count: "1" }],
    new Date("2026-10-06T08:00:00Z"),
    new Date("2026-10-09T20:00:00Z"),
  );
  assert.deepEqual(series, [
    { date: "2026-10-06", count: 0 },
    { date: "2026-10-07", count: 2 },
    { date: "2026-10-08", count: 0 },
    { date: "2026-10-09", count: 1 },
  ]);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransition,
  createAppointmentSchema,
  findConflicts,
  rangesOverlap,
  updateAppointmentSchema,
} from "./rules";

const valid = {
  title: "Site visit",
  type: "SITE_VISIT",
  startsAt: "2026-10-12T09:00:00+01:00",
  endsAt: "2026-10-12T10:00:00+01:00",
  timezone: "Africa/Lagos",
};

test("accepts a valid appointment and keeps offsets as the same instant", () => {
  const parsed = createAppointmentSchema.parse(valid);
  assert.equal(new Date(parsed.startsAt).toISOString(), "2026-10-12T08:00:00.000Z");
});

test("rejects end before or equal to start, and over-long appointments", () => {
  assert.equal(createAppointmentSchema.safeParse({ ...valid, endsAt: valid.startsAt }).success, false);
  assert.equal(createAppointmentSchema.safeParse({ ...valid, endsAt: "2026-10-12T08:00:00+01:00" }).success, false);
  assert.equal(createAppointmentSchema.safeParse({ ...valid, endsAt: "2026-10-14T09:00:00+01:00" }).success, false);
});

test("rejects missing title and unknown time zones", () => {
  assert.equal(createAppointmentSchema.safeParse({ ...valid, title: "  " }).success, false);
  assert.equal(createAppointmentSchema.safeParse({ ...valid, timezone: "Mars/Base" }).success, false);
});

test("reschedule requires both start and end", () => {
  assert.equal(updateAppointmentSchema.safeParse({ startsAt: valid.startsAt }).success, false);
  assert.ok(updateAppointmentSchema.safeParse({ startsAt: valid.startsAt, endsAt: valid.endsAt }).success);
  assert.ok(updateAppointmentSchema.safeParse({ status: "COMPLETED" }).success);
});

test("status transitions: open states move on, terminal states are final", () => {
  assert.ok(canTransition("SCHEDULED", "CONFIRMED"));
  assert.ok(canTransition("CONFIRMED", "COMPLETED"));
  assert.ok(canTransition("SCHEDULED", "NO_SHOW"));
  assert.equal(canTransition("COMPLETED", "SCHEDULED"), false);
  assert.equal(canTransition("CANCELLED", "CONFIRMED"), false);
});

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 12, h, m));

test("overlap is half-open: back-to-back appointments do not conflict", () => {
  assert.equal(rangesOverlap({ startsAt: at(9), endsAt: at(10) }, { startsAt: at(10), endsAt: at(11) }), false);
  assert.equal(rangesOverlap({ startsAt: at(9), endsAt: at(10, 1) }, { startsAt: at(10), endsAt: at(11) }), true);
});

test("conflicts ignore cancelled, no-show, completed and the appointment itself", () => {
  const existing = [
    { id: "a", status: "SCHEDULED" as const, startsAt: at(9), endsAt: at(10) },
    { id: "b", status: "CANCELLED" as const, startsAt: at(9), endsAt: at(10) },
    { id: "c", status: "NO_SHOW" as const, startsAt: at(9), endsAt: at(10) },
    { id: "d", status: "CONFIRMED" as const, startsAt: at(9, 30), endsAt: at(10, 30) },
  ];
  const result = findConflicts({ startsAt: at(9, 15), endsAt: at(9, 45) }, existing);
  assert.deepEqual(result.map((r) => r.id), ["a", "d"]);
  assert.deepEqual(findConflicts({ id: "a", startsAt: at(9, 15), endsAt: at(9, 45) }, existing).map((r) => r.id), ["d"]);
});

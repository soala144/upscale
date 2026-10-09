import assert from "node:assert/strict";
import test from "node:test";

import { sendTelegramMessageDetailed } from "./client";

function mockFetch(t: test.TestContext, impl: typeof fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  t.after(() => { globalThis.fetch = original; });
}

const respond = (status: number, body: unknown) => async () => Response.json(body, { status });

test("success returns the provider message id", async (t) => {
  mockFetch(t, respond(200, { ok: true, result: { message_id: 77 } }));
  assert.deepEqual(await sendTelegramMessageDetailed("t", 1, "hi"), { ok: true, messageId: 77 });
});

test("classifies provider failures", async (t) => {
  const cases: Array<[number, unknown, string]> = [
    [429, { ok: false, error_code: 429, parameters: { retry_after: 3 } }, "RATE_LIMITED"],
    [403, { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }, "BLOCKED"],
    [400, { ok: false, error_code: 400 }, "INVALID"],
    [401, { ok: false, error_code: 401 }, "UNAUTHORIZED"],
    [502, { ok: false, error_code: 502 }, "TRANSIENT"],
  ];
  for (const [status, body, kind] of cases) {
    mockFetch(t, respond(status, body));
    const result = await sendTelegramMessageDetailed("t", 1, "hi");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, kind);
      if (kind === "RATE_LIMITED") assert.equal(result.retryAfterSeconds, 3);
    }
  }
});

test("network failure is an unknown outcome (never auto-retried) and leaks nothing", async (t) => {
  mockFetch(t, async () => { throw new Error("socket closed for bot SECRET-TOKEN"); });
  const result = await sendTelegramMessageDetailed("SECRET-TOKEN", 1, "hi");
  assert.deepEqual(result, { ok: false, kind: "UNKNOWN_OUTCOME" });
});

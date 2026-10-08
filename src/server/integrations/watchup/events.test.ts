import assert from "node:assert/strict";
import test from "node:test";

import { initializeWatchup } from "./client";
import { trackEvent } from "./events";

test("allows numeric AI token counts but rejects secret values", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestBody: { events?: { properties?: Record<string, unknown> }[] } = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as typeof requestBody;
    return Response.json({ accepted: true });
  };

  const watchup = initializeWatchup("test-watchup-key");
  assert.ok(watchup);
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await watchup.shutdown();
  });

  trackEvent("ai.request.completed", {
    input_tokens: 10,
    output_tokens: 20,
    total_tokens: 30,
  });
  trackEvent("ai.request.failed", { input_tokens: "not-a-count" });
  await watchup.flush();

  assert.equal(requestBody.events?.length, 1);
  assert.equal(requestBody.events?.[0].properties?.input_tokens, 10);
  assert.equal(requestBody.events?.[0].properties?.output_tokens, 20);
  assert.equal(requestBody.events?.[0].properties?.total_tokens, 30);
});

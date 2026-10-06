import assert from "node:assert/strict";
import test from "node:test";

import { createBachsCheckout } from "./checkout";

process.env.DATABASE_URL = "postgres://localhost/upscale_test";
process.env.BETTER_AUTH_SECRET = "test-auth-secret-with-more-than-32-characters";
process.env.BETTER_AUTH_URL = "https://upscale.example";
process.env.TELEGRAM_BOT_TOKEN_ENCRYPTION_KEY = "00".repeat(32);
process.env.BACHS_API_KEY = "sk_sandbox_test";
process.env.BACHS_ENV = "sandbox";

test("creates a customer checkout on the connected account", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestHeaders: Headers | undefined;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestHeaders = new Headers(init?.headers);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      checkout_id: "chk_test",
      checkout_url: "https://checkout.bachs.io/session/test",
      reference: "payment_test",
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const checkout = await createBachsCheckout({
    amount: 4_999.5,
    currency: "NGN",
    reference: "payment_test",
    idempotencyKey: "payment_test",
    accountId: "acct_business",
    customer: { email: "customer@example.com", name: "Test Customer" },
    successUrl: "https://upscale.example/payments",
    cancelUrl: "https://upscale.example/payments",
    metadata: { organization_id: "org_test", lead_id: "lead_test" },
  });

  assert.equal(requestUrl, "https://sandbox-api.bachs.io/v1/checkout-sessions");
  assert.equal(requestHeaders?.get("X-Account-Id"), "acct_business");
  assert.equal(requestHeaders?.get("Idempotency-Key"), "payment_test");
  assert.deepEqual(requestBody?.pricing, { amount: "4999.50", currency: "NGN" });
  assert.equal("accountId" in (requestBody ?? {}), false);
  assert.equal(checkout.checkoutId, "chk_test");
});

test("rejects checkout amounts with more than two decimal places", async () => {
  await assert.rejects(
    createBachsCheckout({
      amount: 10.001,
      currency: "NGN",
      reference: "payment_test",
      idempotencyKey: "payment_test",
      customer: {},
      successUrl: "https://upscale.example/payments",
      cancelUrl: "https://upscale.example/payments",
      metadata: {},
    }),
    /at most two decimal places/,
  );
});

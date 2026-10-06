import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  createBachsAccountLink,
  createBachsConnectedAccount,
  getConnectedAccountState,
} from "./accounts";
import { verifyBachsWebhookSignature } from "./verification";

const secret = "local-test-secret";
const payload = JSON.stringify({ id: "evt_test", type: "collection.succeeded" });
const timestamp = 1_700_000_000;
const digest = createHmac("sha256", secret)
  .update(`${timestamp}.${payload}`)
  .digest("hex");
const header = `t=${timestamp},v1=${digest}`;

test("accepts a current matching Bachs signature", () => {
  assert.equal(
    verifyBachsWebhookSignature(payload, header, secret, timestamp),
    true,
  );
});

test("rejects a modified payload", () => {
  assert.equal(
    verifyBachsWebhookSignature(`${payload} `, header, secret, timestamp),
    false,
  );
});

test("rejects stale signatures", () => {
  assert.equal(
    verifyBachsWebhookSignature(payload, header, secret, timestamp + 301),
    false,
  );
});

test("rejects missing or malformed signatures", () => {
  assert.equal(verifyBachsWebhookSignature(payload, null, secret, timestamp), false);
  assert.equal(
    verifyBachsWebhookSignature(payload, `t=${timestamp},v1=invalid`, secret, timestamp),
    false,
  );
});

test("reports READY only when an NGN payment capability is active", () => {
  const state = getConnectedAccountState({
    id: "acct_test",
    capabilities: {
      ngn_card_collection: { status: "restricted" },
      bank_transfer: { status: "active" },
    },
    requirements: { currently_due: [], past_due: [], errors: [] },
  });

  assert.equal(state.ready, true);
});

test("keeps restricted accounts in onboarding even with no current requirements", () => {
  const state = getConnectedAccountState({
    id: "acct_test",
    capabilities: {
      ngn_card_collection: { status: "restricted" },
      bank_transfer: { status: "unrequested" },
    },
    requirements: { currently_due: [], past_due: [], errors: [] },
  });

  assert.equal(state.ready, false);
  assert.equal(state.onboardingRequired, false);
});

test("flags accounts that still have required information to submit", () => {
  const state = getConnectedAccountState({
    id: "acct_test",
    capabilities: { ngn_card_collection: { status: "restricted" } },
    requirements: {
      currently_due: ["business.profile"],
      past_due: [],
      errors: [],
    },
  });

  assert.equal(state.ready, false);
  assert.equal(state.onboardingRequired, true);
});

test("creates a merchant account and a provider-hosted onboarding link", async (t) => {
  const requiredEnvironment = {
    DATABASE_URL: "postgres://localhost:5432/upscale_test",
    BETTER_AUTH_SECRET: "test-auth-secret-with-more-than-32-characters",
    BETTER_AUTH_URL: "https://upscale.example",
    TELEGRAM_BOT_TOKEN_ENCRYPTION_KEY: "00".repeat(32),
    BACHS_API_KEY: "sk_sandbox_test",
    BACHS_ENV: "sandbox",
  };
  const previousEnvironment = new Map(
    Object.keys(requiredEnvironment).map((key) => [
      key,
      process.env[key],
    ]),
  );
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  for (const [key, value] of Object.entries(requiredEnvironment)) {
    process.env[key] = value;
  }
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    const body =
      String(input).endsWith("/account-links")
        ? { url: "https://connect.bachs.io/setup/test-link" }
        : {
            id: "acct_test",
            capabilities: {
              ngn_card_collection: { status: "restricted" },
              bank_transfer: { status: "restricted" },
            },
            requirements: {
              currently_due: ["business.profile"],
              past_due: [],
              errors: [],
            },
          };
    return new Response(JSON.stringify(body), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of previousEnvironment) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  const account = await createBachsConnectedAccount({
    organizationId: "org_test",
    displayName: "Test Business",
    contactEmail: "owner@example.com",
  });
  const onboardingUrl = await createBachsAccountLink(
    account.id,
    "onboarding",
    "https://upscale.example",
  );
  const accountRequestBody = JSON.parse(
    String(requests[0].init?.body),
  ) as {
    country: string;
    entity_type: string;
    configuration: {
      merchant: {
        capabilities: Record<string, { requested: boolean }>;
      };
    };
  };

  assert.equal(requests[0].url, "https://sandbox-api.bachs.io/v1/accounts");
  assert.equal(
    new Headers(requests[0].init?.headers).get("Idempotency-Key"),
    "upscale-connect-org_test",
  );
  assert.equal(accountRequestBody.country, "NG");
  assert.equal(accountRequestBody.entity_type, "company");
  assert.equal(
    accountRequestBody.configuration.merchant.capabilities
      .ngn_card_collection.requested,
    true,
  );
  assert.equal(
    accountRequestBody.configuration.merchant.capabilities
      .bank_transfer.requested,
    true,
  );
  assert.equal(
    requests[1].url,
    "https://sandbox-api.bachs.io/v1/accounts/acct_test/account-links",
  );
  assert.equal(onboardingUrl, "https://connect.bachs.io/setup/test-link");
});

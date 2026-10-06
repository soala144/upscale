import "dotenv/config";

import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";

import { POST as bachsWebhook } from "../../../app/api/webhooks/bachs/route";
import { getDatabase } from "@/db";
import { conversations } from "@/db/schema/conversations";
import { leads } from "@/db/schema/leads";
import { messages } from "@/db/schema/messages";
import { organizations } from "@/db/schema/organizations";
import { payments } from "@/db/schema/payments";
import { telegramConnections } from "@/db/schema/telegram-connections";
import { telegramUpdates } from "@/db/schema/telegram-updates";
import {
  encryptTelegramToken,
} from "@/lib/crypto/telegram-token";
import { processTelegramUpdate } from "@/server/telegram/webhook-service";
import { createCustomerCheckout } from "@/server/payments/service";

process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.BACHS_WEBHOOK_SECRET = "test-bachs-webhook-secret";
process.env.BACHS_API_KEY = "sk_sandbox_test";
process.env.BACHS_ENV = "sandbox";

const integrationTestsEnabled =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1";

test(
  "Telegram webhook persists one tenant-scoped conversation and sends one reply",
  { skip: !integrationTestsEnabled },
  async (t) => {
    const db = getDatabase();
    const organizationId = randomUUID();
    const connectionId = randomUUID();
    const updateId = 928_374_651;
    const token = "123456:test-telegram-token";
    const encryptedToken = encryptTelegramToken(token);
    const originalFetch = globalThis.fetch;
    let anthropicCalls = 0;
    let telegramCalls = 0;

    t.after(async () => {
      globalThis.fetch = originalFetch;
      await db
        .delete(organizations)
        .where(eq(organizations.id, organizationId));
      await db.$client.end();
    });

    await db.insert(organizations).values({
      id: organizationId,
      name: "Integration Test Homes",
      slug: `integration-${organizationId}`,
      industry: "Real estate",
      description: "Residential property sales",
      agentPrompt: "Focus on homes in Lagos.",
      bachsAccountId: "acct_integration",
      bachsAccountStatus: "READY",
    });
    await db.insert(telegramConnections).values({
      id: connectionId,
      organizationId,
      botId: `bot-${connectionId}`,
      botUsername: `test_${connectionId.replaceAll("-", "")}`,
      botName: "Integration Test Bot",
      encryptedBotToken: encryptedToken.ciphertext,
      encryptionIv: encryptedToken.iv,
      encryptionAuthTag: encryptedToken.authTag,
      webhookSecretHash: "0".repeat(64),
      status: "CONNECTED",
    });
    await db.insert(telegramUpdates).values({
      id: randomUUID(),
      organizationId,
      connectionId,
      updateId,
      status: "RECEIVED",
    });

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url === "https://api.anthropic.com/v1/messages") {
        anthropicCalls += 1;
        const requestBody = JSON.parse(String(init?.body)) as {
          system: string;
        };
        assert.match(requestBody.system, /Integration Test Homes/);
        assert.match(requestBody.system, /Focus on homes in Lagos/);

        return Response.json({
          id: "msg_integration",
          type: "message",
          role: "assistant",
          model: "claude-sonnet-5-5",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                reply: "What kind of home are you looking for?",
                qualification: {
                  need: "A home",
                  budget: null,
                  location: "Lagos",
                  timeline: null,
                  decision_maker: null,
                },
                summary: "Looking for a home in Lagos.",
                human_requested: false,
                handoff_required: false,
              }),
            },
          ],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 20 },
        });
      }

      if (url === `https://api.telegram.org/bot${token}/sendMessage`) {
        telegramCalls += 1;
        const requestBody = JSON.parse(String(init?.body)) as {
          chat_id: number;
          text: string;
        };
        assert.equal(requestBody.chat_id, 78_901);
        assert.equal(requestBody.text, "What kind of home are you looking for?");
        return Response.json({ ok: true, result: { message_id: 55 } });
      }

      if (url === "https://sandbox-api.bachs.io/v1/accounts/acct_integration") {
        return Response.json({
          id: "acct_integration",
          capabilities: {
            ngn_card_collection: { status: "active" },
            bank_transfer: { status: "unrequested" },
          },
          requirements: { currently_due: [], past_due: [], errors: [] },
        });
      }

      if (url === "https://sandbox-api.bachs.io/v1/checkout-sessions") {
        assert.equal(new Headers(init?.headers).get("X-Account-Id"), "acct_integration");
        const requestBody = JSON.parse(String(init?.body)) as {
          pricing: { amount: string; currency: string };
          reference: string;
        };
        assert.deepEqual(requestBody.pricing, {
          amount: "4999.50",
          currency: "NGN",
        });
        return Response.json({
          checkout_id: "chk_integration",
          checkout_url: "https://checkout.bachs.io/session/integration",
          reference: requestBody.reference,
        });
      }

      throw new Error(`Unexpected integration-test request: ${url}`);
    };

    const update = {
      update_id: updateId,
      message: {
        message_id: 17,
        date: 1_700_000_000,
        text: "I need a home in Lagos.",
        chat: {
          id: 78_901,
          type: "private" as const,
          first_name: "Test",
        },
        from: {
          id: 45_678,
          is_bot: false,
          first_name: "Alex",
        },
      },
    };
    const [connection] = await db
      .select()
      .from(telegramConnections)
      .where(eq(telegramConnections.id, connectionId));
    assert.ok(connection);
    const [newReceipt] = await db
      .select()
      .from(telegramUpdates)
      .where(eq(telegramUpdates.connectionId, connectionId));
    assert.equal(newReceipt.status, "RECEIVED");
    const firstResult = await processTelegramUpdate(connection, update);
    assert.equal(
      "replySent" in firstResult && firstResult.replySent,
      true,
      JSON.stringify({
        firstResult,
        anthropicCalls,
        telegramCalls,
      }),
    );
    const duplicateResult = await processTelegramUpdate(connection, update);
    assert.equal(duplicateResult.duplicate, true);

    const [savedLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.organizationId, organizationId));
    assert.ok(savedLead);
    assert.equal(savedLead.telegramUserId, "45678");
    assert.equal(savedLead.location, "Lagos");
    assert.equal(savedLead.score, 25);
    assert.equal(savedLead.stage, "COLD");

    const savedConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.organizationId, organizationId));
    assert.equal(savedConversations.length, 1);

    const savedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.organizationId, organizationId));
    assert.deepEqual(
      savedMessages.map((message) => message.role).sort(),
      ["ASSISTANT", "USER"],
    );
    assert.equal(anthropicCalls, 1);
    assert.equal(telegramCalls, 1);

    const checkout = await createCustomerCheckout(organizationId, {
      leadId: savedLead.id,
      amount: 4_999.5,
    });
    assert.equal(
      checkout.checkoutUrl,
      "https://checkout.bachs.io/session/integration",
    );
    const paymentId = checkout.paymentId;
    const [pendingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    assert.equal(pendingPayment.providerAccountId, "acct_integration");
    assert.equal(pendingPayment.status, "PENDING");
    assert.equal(pendingPayment.amount, "4999.50");
    const [paymentPendingLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, savedLead.id));
    assert.equal(paymentPendingLead.stage, "PAYMENT_PENDING");

    const event = {
      id: randomUUID(),
      type: "collection.succeeded",
      account: "acct_integration",
      data: {
        checkout_id: "chk_integration",
        reference: paymentId,
        amount: "4999.50",
        currency: "NGN",
      },
    };
    const rawEvent = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1_000);
    const signature = createHmac("sha256", process.env.BACHS_WEBHOOK_SECRET!)
      .update(`${timestamp}.${rawEvent}`)
      .digest("hex");
    const sendPaymentWebhook = () =>
      bachsWebhook(
        new Request("https://upscale.example/api/webhooks/bachs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Bachs-Signature-V2": `t=${timestamp},v1=${signature}`,
          },
          body: rawEvent,
        }),
      );

    const paidResponse = await sendPaymentWebhook();
    assert.equal(paidResponse.status, 200);
    assert.equal((await paidResponse.json()).duplicate, false);
    const duplicatePaymentWebhook = await sendPaymentWebhook();
    assert.equal(duplicatePaymentWebhook.status, 200);
    assert.equal((await duplicatePaymentWebhook.json()).duplicate, true);

    const [paidPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    const [convertedLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, savedLead.id));
    assert.equal(paidPayment.status, "PAID");
    assert.equal(convertedLead.stage, "CONVERTED");
  },
);

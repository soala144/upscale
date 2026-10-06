import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteTelegramWebhook,
  getTelegramBot,
  registerTelegramWebhook,
  TelegramApiError,
} from "./client";

test("validates a bot with getMe without exposing provider error details", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";

  globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return Response.json({
      ok: true,
      result: {
        id: 123456,
        is_bot: true,
        first_name: "Test Bot",
        username: "upscale_test_bot",
      },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const bot = await getTelegramBot("test-token");
  assert.equal(bot.id, 123456);
  assert.equal(bot.username, "upscale_test_bot");
  assert.equal(
    requestUrl,
    "https://api.telegram.org/bottest-token/getMe",
  );
});

test("registers only message updates with the per-connection webhook secret", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ ok: true, result: true });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await registerTelegramWebhook(
    "test-token",
    "https://upscale.example/api/webhooks/telegram/connection",
    "per-connection-secret",
  );

  assert.equal(
    requestBody?.url,
    "https://upscale.example/api/webhooks/telegram/connection",
  );
  assert.equal(requestBody?.secret_token, "per-connection-secret");
  assert.deepEqual(requestBody?.allowed_updates, ["message"]);
});

test("removes a bot webhook", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";

  globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return Response.json({ ok: true, result: true });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await deleteTelegramWebhook("test-token");
  assert.equal(
    requestUrl,
    "https://api.telegram.org/bottest-token/deleteWebhook",
  );
});

test("reports invalid bot tokens without returning Telegram's raw error", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      ok: false,
      description: "private provider detail",
      error_code: 401,
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(getTelegramBot("test-token"), (error: unknown) => {
    assert.ok(error instanceof TelegramApiError);
    assert.equal(error.status, 400);
    assert.equal(error.message, "Telegram bot token is invalid");
    assert.equal(error.message.includes("private provider detail"), false);
    return true;
  });
});

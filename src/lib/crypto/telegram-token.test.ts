import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptTelegramToken,
  encryptTelegramToken,
  generateTelegramWebhookSecret,
  hashTelegramWebhookSecret,
  verifyTelegramWebhookSecret,
} from "./telegram-token";

process.env.DATABASE_URL = "postgres://localhost:5432/upscale_test";
process.env.BETTER_AUTH_SECRET = "test-auth-secret-with-more-than-32-characters";
process.env.BETTER_AUTH_URL = "https://upscale.example";
process.env.TELEGRAM_BOT_TOKEN_ENCRYPTION_KEY = "ab".repeat(32);

test("encrypts bot credentials with authenticated AES-256-GCM", () => {
  const token = "123456789:telegram-test-secret";
  const encrypted = encryptTelegramToken(token);

  assert.notEqual(encrypted.ciphertext, token);
  assert.notEqual(encrypted.iv, "");
  assert.notEqual(encrypted.authTag, "");
  assert.equal(decryptTelegramToken(encrypted), token);
});

test("rejects modified encrypted token data", () => {
  const encrypted = encryptTelegramToken("telegram-test-secret");
  const modifiedAuthTag = `${encrypted.authTag[0] === "0" ? "1" : "0"}${encrypted.authTag.slice(1)}`;

  assert.throws(() =>
    decryptTelegramToken({ ...encrypted, authTag: modifiedAuthTag }),
  );
});

test("generates and verifies Telegram webhook secrets without storing them plaintext", () => {
  const secret = generateTelegramWebhookSecret();
  const hash = hashTelegramWebhookSecret(secret);

  assert.match(secret, /^[A-Za-z0-9_-]{1,256}$/);
  assert.notEqual(hash, secret);
  assert.equal(verifyTelegramWebhookSecret(secret, hash), true);
  assert.equal(verifyTelegramWebhookSecret("incorrect-secret", hash), false);
  assert.equal(verifyTelegramWebhookSecret(null, hash), false);
});

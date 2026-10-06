import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { getServerEnv } from "@/lib/env/server";

export function encryptTelegramToken(token: string) {
  const key = Buffer.from(
    getServerEnv().TELEGRAM_BOT_TOKEN_ENCRYPTION_KEY,
    "hex",
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("hex"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptTelegramToken(input: {
  ciphertext: string;
  iv: string;
  authTag: string;
}) {
  const key = Buffer.from(
    getServerEnv().TELEGRAM_BOT_TOKEN_ENCRYPTION_KEY,
    "hex",
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(input.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(input.authTag, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function generateTelegramWebhookSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashTelegramWebhookSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifyTelegramWebhookSecret(
  secret: string | null,
  storedHash: string,
) {
  if (!secret) {
    return false;
  }

  const providedHash = Buffer.from(hashTelegramWebhookSecret(secret), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");
  return (
    providedHash.length === expectedHash.length &&
    timingSafeEqual(providedHash, expectedHash)
  );
}

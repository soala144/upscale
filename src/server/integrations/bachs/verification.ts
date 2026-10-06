import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_TOLERANCE_SECONDS = 300;

export function verifyBachsWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const fields = signatureHeader.split(",").map((field) => {
    const separator = field.indexOf("=");
    return separator < 0
      ? ["", ""]
      : [field.slice(0, separator).trim(), field.slice(separator + 1).trim()];
  });
  const timestampValue = fields.find(([key]) => key === "t")?.[1];
  const signatures = fields
    .filter(([key]) => key === "v1")
    .map(([, value]) => value)
    .filter((value) => /^[\da-f]{64}$/i.test(value));
  const timestamp = Number(timestampValue);

  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS ||
    signatures.length === 0
  ) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest();

  return signatures.some((signature) => {
    const provided = Buffer.from(signature, "hex");
    return (
      provided.length === expected.length &&
      timingSafeEqual(provided, expected)
    );
  });
}

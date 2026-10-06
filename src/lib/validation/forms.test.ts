import assert from "node:assert/strict";
import test from "node:test";

import {
  agentFormSchema,
  businessProfileFormSchema,
  createAuthFormSchema,
  paymentFormSchema,
  settingsFormSchema,
  telegramFormSchema,
} from "./forms";

test("sign-up validates trimmed identity, email and password confirmation", () => {
  const schema = createAuthFormSchema(true);
  assert.equal(schema.safeParse({
    name: "  Ada Lovelace ",
    email: "ada@example.com",
    password: "long-enough-password",
    confirmPassword: "long-enough-password",
  }).success, true);

  const invalid = schema.safeParse({
    name: "  ",
    email: "ada@",
    password: "short",
    confirmPassword: "different",
  });
  assert.equal(invalid.success, false);
  if (!invalid.success) {
    const fields = invalid.error.issues.map((issue) => issue.path[0]);
    assert.ok(fields.includes("name"));
    assert.ok(fields.includes("email"));
    assert.ok(fields.includes("password"));
    assert.ok(fields.includes("confirmPassword"));
  }
});

test("sign-in requires a valid email and non-empty password without sign-up-only rules", () => {
  const schema = createAuthFormSchema(false);
  assert.equal(schema.safeParse({ email: "user@example.com", password: "x" }).success, true);
  assert.equal(schema.safeParse({ email: "user@", password: "" }).success, false);
});

test("business and agent profiles reject whitespace-only required values", () => {
  assert.equal(businessProfileFormSchema.safeParse({
    name: "   ",
    slug: "valid-slug",
    industry: "Services",
    description: "A useful description",
  }).success, false);
  assert.equal(businessProfileFormSchema.safeParse({
    name: "Valid name",
    slug: "valid-slug",
    industry: "Services",
    description: "   ",
  }).success, false);
  assert.equal(agentFormSchema.safeParse({
    agentName: "   ",
    description: "Useful business description",
    agentPrompt: "",
  }).success, false);
});

test("Telegram credentials are trimmed but required", () => {
  const parsed = telegramFormSchema.safeParse({ botToken: "  token-value  " });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.botToken, "token-value");
  assert.equal(telegramFormSchema.safeParse({ botToken: "   " }).success, false);
});

test("payment amount rejects malformed, non-positive, over-precision and excessive values", () => {
  for (const amount of ["", " ", "NaN", "Infinity", "-10", "0", "1.001", "99999999999.99"]) {
    assert.equal(paymentFormSchema.safeParse({ amount }).success, false, `expected ${amount} to be rejected`);
  }
  const valid = paymentFormSchema.safeParse({ amount: "250000.50" });
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.data.amount, 250000.5);
});

test("settings allow optional email and instructions but validate business fields", () => {
  const values = {
    name: "Business",
    slug: "business",
    industry: "",
    description: "A meaningful business description",
    email: "",
    agentName: "Helen",
    agentPrompt: "",
  };
  assert.equal(settingsFormSchema.safeParse(values).success, true);
  assert.equal(settingsFormSchema.safeParse({ ...values, email: "not-an-email" }).success, false);
  assert.equal(settingsFormSchema.safeParse({ ...values, description: "  " }).success, false);
});

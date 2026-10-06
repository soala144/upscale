import assert from "node:assert/strict";
import test from "node:test";

import { customerCheckoutSchema } from "./billing";

test("customer checkout accepts a lead and valid NGN amount", () => {
  assert.equal(
    customerCheckoutSchema.safeParse({
      leadId: "lead_123",
      amount: 2500.5,
    }).success,
    true,
  );
});

test("customer checkout rejects invalid amounts and client-owned account fields", () => {
  for (const input of [
    { leadId: "lead_123", amount: 0 },
    { leadId: "lead_123", amount: -1 },
    { leadId: "lead_123", amount: 10.001 },
    { leadId: "lead_123", amount: 100, providerAccountId: "acct_other" },
  ]) {
    assert.equal(customerCheckoutSchema.safeParse(input).success, false);
  }
});

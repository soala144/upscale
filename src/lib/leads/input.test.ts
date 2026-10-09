import assert from "node:assert/strict";
import test from "node:test";

import { parseStartPayload } from "@/lib/telegram/start";

import { csvToLeads, leadInputSchema, normalizePhone, publicLeadSchema } from "./input";

test("normalizes Nigerian and international phone numbers", () => {
  assert.equal(normalizePhone("0803 123 4567"), "+2348031234567");
  assert.equal(normalizePhone("234-803-123-4567"), "+2348031234567");
  assert.equal(normalizePhone("+1 (415) 555-0123"), "+14155550123");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("call me"), null);
  assert.equal(normalizePhone(""), null);
});

test("a lead needs a name and a phone or email", () => {
  assert.equal(leadInputSchema.safeParse({ name: "Ada" }).success, false);
  assert.equal(leadInputSchema.safeParse({ name: "", phone: "08031234567" }).success, false);
  assert.equal(leadInputSchema.safeParse({ name: "Ada", phone: "abc" }).success, false);
  assert.equal(leadInputSchema.safeParse({ name: "Ada", email: "not-an-email" }).success, false);
  const ok = leadInputSchema.parse({ name: "Ada", email: "ADA@Example.com", budget: 5000 });
  assert.equal(ok.email, "ada@example.com");
  assert.equal(ok.phone, null);
});

test("csv import validates rows and reports problems by line", () => {
  const csv = [
    "Name,Phone,Email,Need,Budget,Decision maker",
    'Ada Okafor,08031234567,,"3-bed flat, Lekki","₦25,000,000",yes',
    "No Contact,,,flat,,",
    "Bad Budget,08031234568,,flat,lots,",
  ].join("\n");
  const { leads, problems } = csvToLeads(csv);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].budget, 25_000_000);
  assert.equal(leads[0].decisionMaker, true);
  assert.equal(leads[0].need, "3-bed flat, Lekki");
  assert.equal(problems.length, 2);
  assert.match(problems[0], /Row 3/);
  assert.match(problems[1], /Row 4/);
  assert.match(csvToLeads("phone\n0803").problems[0], /name column/);
});

test("public form requires consent and rejects honeypot fills", () => {
  const base = { name: "Ada", phone: "08031234567", need: "A flat", consent: true as const };
  assert.ok(publicLeadSchema.safeParse(base).success);
  assert.equal(publicLeadSchema.safeParse({ ...base, consent: false }).success, false);
  assert.equal(publicLeadSchema.safeParse({ ...base, website: "http://spam" }).success, false);
  assert.equal(publicLeadSchema.safeParse({ ...base, source: "bad tag!" }).success, false);
  assert.ok(publicLeadSchema.safeParse({ ...base, source: "instagram-oct", email: "" }).success);
});

test("telegram start payloads", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assert.deepEqual(parseStartPayload(`/start f_${id}`), { type: "lead", leadId: id });
  assert.deepEqual(parseStartPayload("/start s_Instagram-Oct"), { type: "source", tag: "instagram-oct" });
  assert.equal(parseStartPayload("/start"), "bare");
  assert.equal(parseStartPayload("/start f_not-a-uuid"), "bare");
  assert.equal(parseStartPayload("hello"), null);
  assert.equal(parseStartPayload("please /start"), null);
});

import assert from "node:assert/strict";
import test from "node:test";

import { buildQualificationInstructions } from "@/server/ai/prompts";
import { csvToProducts, knowledgeItemSchema } from "@/lib/validation/knowledge";

import { formatEntry, selectKnowledge, type KnowledgeEntry } from "./select";

const product = (title: string, content = "item", price: string | null = "1000"): KnowledgeEntry => ({
  kind: "PRODUCT", title, content, price, currency: "NGN", available: true,
});

test("small catalogues are sent whole", () => {
  const entries = [product("Sneakers"), product("Bag")];
  assert.deepEqual(selectKnowledge(entries, "anything"), entries);
});

test("large catalogues are ranked by relevance and trimmed to the budget", () => {
  const entries = Array.from({ length: 40 }, (_, i) => product(`Item ${i}`, "generic filler ".repeat(20)));
  entries[33] = product("Leather wallet", "Brown leather wallet");
  const picked = selectKnowledge(entries, "how much is the leather wallet?", 2_000);
  assert.equal(picked[0].title, "Leather wallet");
  assert.ok(picked.reduce((n, e) => n + formatEntry(e).length, 0) <= 2_000);
});

test("entries format prices and availability", () => {
  assert.match(formatEntry(product("Sneakers", "Size 42", "25000")), /NGN 25,000/);
  assert.match(formatEntry({ ...product("Bag"), available: false }), /unavailable/);
  assert.match(formatEntry({ kind: "FAQ", title: "Delivery?", content: "2 days", price: null, currency: "NGN", available: true }), /Q: Delivery\?\nA: 2 days/);
});

test("prompt includes knowledge and forbids guessing, or warns when none exists", () => {
  const org = { id: "o", name: "Shop", industry: null, description: null, agentName: "Helen", agentPrompt: null };
  const lead = { need: null, budget: null, location: null, timeline: null, decisionMaker: null };
  const withKnowledge = buildQualificationInstructions(org, lead, [product("Sneakers", "Size 42", "25000")]);
  assert.match(withKnowledge, /Sneakers/);
  assert.match(withKnowledge, /ONLY from these entries/);
  assert.match(buildQualificationInstructions(org, lead), /Do not state prices/);
});

test("validation rejects FAQ prices and empty fields", () => {
  assert.equal(knowledgeItemSchema.safeParse({ kind: "FAQ", title: "q", content: "a", price: 5, available: true }).success, false);
  assert.equal(knowledgeItemSchema.safeParse({ kind: "PRODUCT", title: " ", content: "a" }).success, false);
  assert.ok(knowledgeItemSchema.safeParse({ kind: "PRODUCT", title: "Bag", content: "Nice", price: 1500 }).success);
});

test("csv import parses quotes, currency symbols and reports bad rows", () => {
  const csv = 'name,price,description,available\n"Bag, large","₦12,500","Fits ""A4"""\nShoe,abc,Bad price\nHat,,No price,no\n';
  const { items, problems } = csvToProducts(csv);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Bag, large");
  assert.equal(items[0].price, 12500);
  assert.equal(items[1].available, false);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Row 3/);
  assert.match(csvToProducts("a,b\n1,2").problems[0], /header/);
});

test("csv import supports FAQ rows through the type column", () => {
  const { items, problems } = csvToProducts("name,price,description,type\nDelivery time?,,2 days,faq\nBag,1000,Nice,product\n");
  assert.deepEqual(problems, []);
  assert.equal(items[0].kind, "FAQ");
  assert.equal(items[0].price, null);
  assert.equal(items[1].kind, "PRODUCT");
});

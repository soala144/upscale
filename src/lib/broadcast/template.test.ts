import assert from "node:assert/strict";
import test from "node:test";

import {
  extractPlaceholders,
  renderTemplate,
  validateTemplateBody,
} from "./template";

test("renders supported variables", () => {
  const text = renderTemplate("Hi {{first_name}}, {{ business_name }} here about {{need}} in {{location}}.", {
    name: "Ada Okafor", businessName: "Acme", need: "a flat", location: "Lekki",
  });
  assert.equal(text, "Hi Ada, Acme here about a flat in Lekki.");
});

test("uses safe fallbacks for missing or blank values and never leaves placeholders", () => {
  const text = renderTemplate("Hello {{first_name}} / {{name}} / {{location}} / {{need}}", {
    name: "   ", location: null,
  });
  assert.equal(text, "Hello there / there / your area / what you asked about");
  assert.doesNotMatch(text, /\{\{|\}\}/);
});

test("unknown variables are rejected by validation and rendered as empty", () => {
  assert.deepEqual(extractPlaceholders("{{contact_name}} {{name}} {{name}}"), ["contact_name", "name"]);
  assert.match(validateTemplateBody("Hi {{contact_name}}").join(" "), /Unsupported variable/);
  assert.equal(renderTemplate("Hi{{contact_name}}!", {}), "Hi!");
});

test("validation flags empty, oversized and malformed bodies", () => {
  assert.ok(validateTemplateBody("   ").length);
  assert.ok(validateTemplateBody("x".repeat(4097)).length);
  assert.match(validateTemplateBody("Hi {{name").join(" "), /unmatched/);
  assert.deepEqual(validateTemplateBody("Hi {{name}}"), []);
});

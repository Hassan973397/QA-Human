import { test } from "node:test";
import assert from "node:assert/strict";
import { SafetyGuard } from "../src/safety/SafetyGuard.js";
import { qaConfigSchema } from "../src/config/schema.js";
import { QaError } from "../src/errors/QaError.js";

const safety = qaConfigSchema.parse({}).safety;

test("allows local/test base URLs", () => {
  const guard = new SafetyGuard(safety);
  assert.equal(guard.evaluate("http://localhost:3000").allowed, true);
  assert.equal(guard.evaluate("https://staging.example.com").allowed, true);
});

test("blocks production-looking base URLs unless explicitly allowed", () => {
  const guard = new SafetyGuard(safety);
  const blocked = guard.evaluate("https://www.example.com");
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasons.length > 0);
  assert.equal(guard.evaluate("https://www.example.com", true).allowed, true);
});

test("testData prefixes labels with the configured prefix", () => {
  const guard = new SafetyGuard(safety);
  assert.equal(guard.testData("order"), "AUTO_HQA_order");
});

test("assertDeletable only permits prefixed values", () => {
  const guard = new SafetyGuard(safety);
  assert.doesNotThrow(() => guard.assertDeletable("AUTO_HQA_123"));
  assert.throws(() => guard.assertDeletable("real_customer"), QaError);
});

test("destructive actions stay off by default", () => {
  const guard = new SafetyGuard(safety);
  assert.equal(guard.destructiveAllowed("http://localhost:3000"), false);
});

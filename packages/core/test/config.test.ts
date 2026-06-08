import { test } from "node:test";
import assert from "node:assert/strict";
import { deepMerge, extractDefault } from "../src/config/loadQaConfig.js";
import { qaConfigSchema } from "../src/config/schema.js";

test("extractDefault unwraps a single default export", () => {
  const cfg = { app: { name: "X" }, roles: { admin: { email: "a@b.c" } } };
  assert.deepEqual(extractDefault({ default: cfg }), cfg);
});

test("extractDefault unwraps a double-nested default (tsx/esm interop)", () => {
  const cfg = { app: { name: "X" }, roles: { admin: { email: "a@b.c" } } };
  // tsImport can wrap the default export twice: mod.default.default === config
  assert.deepEqual(extractDefault({ default: { default: cfg } }), cfg);
});

test("extractDefault returns a bare config object as-is", () => {
  const cfg = { routes: { login: "/login" } };
  assert.deepEqual(extractDefault(cfg), cfg);
});

test("deepMerge merges nested objects and keeps untouched keys", () => {
  const out = deepMerge({ a: { x: 1, y: 2 }, b: 5 }, { a: { y: 3 }, c: 9 });
  assert.deepEqual(out, { a: { x: 1, y: 3 }, b: 5, c: 9 });
});

test("deepMerge replaces arrays instead of concatenating", () => {
  const out = deepMerge({ list: [1, 2, 3] }, { list: [9] });
  assert.deepEqual(out, { list: [9] });
});

test("deepMerge ignores undefined source values", () => {
  const out = deepMerge({ a: 1 }, { a: undefined });
  assert.equal(out.a, 1);
});

test("qaConfigSchema applies sensible defaults for an empty config", () => {
  const parsed = qaConfigSchema.safeParse({});
  assert.ok(parsed.success);
  if (!parsed.success) return;
  assert.equal(parsed.data.app.baseUrl, "http://localhost:3000");
  assert.equal(parsed.data.app.type, "unknown");
  assert.equal(parsed.data.workers, 1);
  assert.equal(parsed.data.retries, 0);
  assert.equal(parsed.data.browser.engine, "chromium");
  assert.equal(parsed.data.visual.maxDiffRatio, 0.02);
  assert.equal(parsed.data.a11y.failOn, "serious");
  assert.equal(parsed.data.safety.testDataPrefix, "AUTO_HQA");
});

test("qaConfigSchema rejects an invalid browser engine", () => {
  const parsed = qaConfigSchema.safeParse({ browser: { engine: "lynx" } });
  assert.equal(parsed.success, false);
});

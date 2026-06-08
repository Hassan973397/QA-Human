import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinScenarios, findBuiltins, scenarioTemplates } from "../src/index.js";

test("every built-in scenario has a valid shape", () => {
  assert.ok(builtinScenarios.length >= 12);
  for (const s of builtinScenarios) {
    assert.equal(typeof s.id, "string");
    assert.ok(s.id.length > 0, `id missing`);
    assert.equal(typeof s.run, "function", `${s.id} run() missing`);
    assert.ok(Array.isArray(s.roles), `${s.id} roles not array`);
    assert.ok(Array.isArray(s.tags), `${s.id} tags not array`);
    assert.ok(["critical", "high", "medium", "low"].includes(s.severity), `${s.id} severity`);
  }
});

test("built-in scenario ids are unique", () => {
  const ids = builtinScenarios.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("findBuiltins resolves by exact id and by substring", () => {
  const exact = findBuiltins(["smoke.pages"]);
  assert.ok(exact.some((s) => s.id === "smoke.pages"));

  const bySubstring = findBuiltins(["security."]);
  assert.ok(bySubstring.length >= 2);
  assert.ok(bySubstring.every((s) => s.id.includes("security.")));
});

test("the expected flagship scenarios are present", () => {
  const ids = new Set(builtinScenarios.map((s) => s.id));
  for (const id of [
    "auth.login",
    "smoke.pages",
    "ecommerce.customerCreateOrder",
    "security.tenantIsolation",
    "visual.pages",
    "a11y.audit",
    "explore.crawl",
  ]) {
    assert.ok(ids.has(id), `missing ${id}`);
  }
});

test("generation templates are non-empty TypeScript snippets", () => {
  assert.ok(scenarioTemplates.length > 0);
  for (const t of scenarioTemplates) {
    assert.ok(t.file.endsWith(".scenario.ts"));
    assert.ok(t.content.includes("scenario("));
  }
});

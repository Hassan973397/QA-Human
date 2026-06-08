import { test } from "node:test";
import assert from "node:assert/strict";
import { joinUrl } from "../src/utils/path.js";
import { formatDuration } from "../src/utils/time.js";
import { mapLimit } from "../src/utils/concurrency.js";
import { shortHash } from "../src/utils/hash.js";
import { RuleBasedAiAnalyzer } from "../src/ai/AiAnalyzer.js";
import type { AppKnowledgeGraph } from "../src/knowledge/types.js";

test("joinUrl normalizes base + path and respects absolute URLs", () => {
  assert.equal(joinUrl("http://h", "/a"), "http://h/a");
  assert.equal(joinUrl("http://h/", "a"), "http://h/a");
  assert.equal(joinUrl("http://h", "https://other/x"), "https://other/x");
});

test("formatDuration is human-readable", () => {
  assert.equal(formatDuration(500), "500ms");
  assert.equal(formatDuration(1500), "1.5s");
  assert.equal(formatDuration(65_000), "1m 5s");
});

test("mapLimit preserves order with bounded concurrency", async () => {
  const out = await mapLimit([1, 2, 3, 4, 5], 2, async (x) => x * 2);
  assert.deepEqual(out, [2, 4, 6, 8, 10]);
});

test("shortHash is deterministic and content-sensitive", () => {
  assert.equal(shortHash("a"), shortHash("a"));
  assert.notEqual(shortHash("a"), shortHash("b"));
  assert.equal(shortHash("a").length, 16);
});

test("AiAnalyzer suggests scenarios from discovered features", () => {
  const graph = {
    features: ["authentication", "ordering", "multi-tenant", "permissions"],
    roles: { customer: { can: [], cannot: [], detectedFrom: [] } },
  } as unknown as AppKnowledgeGraph;
  const ids = new RuleBasedAiAnalyzer().suggestScenarios(graph);
  assert.ok(ids.includes("auth.login"));
  assert.ok(ids.includes("ecommerce.customerCreateOrder"));
  assert.ok(ids.includes("security.tenantIsolation"));
});

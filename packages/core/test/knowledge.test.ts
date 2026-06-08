import { test } from "node:test";
import assert from "node:assert/strict";
import { buildKnowledgeGraph } from "../src/knowledge/AppKnowledgeGraph.js";
import { qaConfigSchema } from "../src/config/schema.js";
import type { DiscoveryResult } from "../src/discovery/types.js";

function discovery(partial: Partial<DiscoveryResult>): DiscoveryResult {
  return {
    frameworks: ["next"],
    isMonorepo: false,
    packageManager: "pnpm",
    scripts: {},
    routes: [],
    pages: [],
    forms: [],
    apiEndpoints: [],
    roles: {},
    permissions: [],
    workflows: [],
    selectors: [],
    features: [],
    unknowns: [],
    filesScanned: 0,
    durationMs: 1,
    ...partial,
  };
}

test("buildKnowledgeGraph merges config selectors with discovery", () => {
  const config = qaConfigSchema.parse({ selectors: { foo: ["#foo"] } });
  const graph = buildKnowledgeGraph(config, discovery({}));
  assert.ok(graph.selectors.some((s) => s.name === "foo" && s.source === "config"));
  assert.equal(graph.app.baseUrl, "http://localhost:3000");
});

test("buildKnowledgeGraph flags multi-tenant apps with no tenant-scoped endpoints", () => {
  const config = qaConfigSchema.parse({});
  const graph = buildKnowledgeGraph(
    config,
    discovery({
      features: ["multi-tenant"],
      apiEndpoints: [
        { method: "GET", path: "/api/orders", source: "x.ts", authGuarded: true, tenantScoped: false },
      ],
    }),
  );
  assert.ok(graph.risks.some((r) => /tenant/i.test(r.message)));
});

test("buildKnowledgeGraph flags unguarded sensitive endpoints", () => {
  const config = qaConfigSchema.parse({});
  const graph = buildKnowledgeGraph(
    config,
    discovery({
      apiEndpoints: [
        { method: "GET", path: "/api/admin/users", source: "x.ts", authGuarded: false, tenantScoped: false },
      ],
    }),
  );
  assert.ok(graph.risks.some((r) => r.severity === "high"));
});

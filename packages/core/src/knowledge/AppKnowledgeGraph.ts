import type { QaConfig } from "../config/schema.js";
import type { DiscoveryResult } from "../discovery/types.js";
import { nowIso } from "../utils/time.js";
import type { AppKnowledgeGraph, RiskNote, SelectorHint } from "./types.js";

/**
 * Combines the validated config with discovery output into the unified
 * App Knowledge Graph that scenarios consume at runtime.
 */
export function buildKnowledgeGraph(
  config: QaConfig,
  discovery: DiscoveryResult,
): AppKnowledgeGraph {
  const selectors = mergeSelectors(config, discovery);
  const risks = deriveRisks(discovery);

  return {
    generatedAt: nowIso(),
    app: { name: config.app.name, baseUrl: config.app.baseUrl, type: config.app.type },
    frameworks: discovery.frameworks,
    packageManager: discovery.packageManager,
    scripts: discovery.scripts,
    routes: discovery.routes,
    pages: discovery.pages,
    forms: discovery.forms,
    apiEndpoints: discovery.apiEndpoints,
    roles: discovery.roles,
    permissions: discovery.permissions,
    workflows: discovery.workflows,
    selectors,
    features: discovery.features,
    risks,
    unknowns: discovery.unknowns,
    stats: { filesScanned: discovery.filesScanned, durationMs: discovery.durationMs },
  };
}

function mergeSelectors(config: QaConfig, discovery: DiscoveryResult): SelectorHint[] {
  const byName = new Map<string, SelectorHint>();
  // config-provided selectors take priority
  for (const [name, candidates] of Object.entries(config.selectors)) {
    byName.set(name, { name, candidates, source: "config" });
  }
  for (const hint of discovery.selectors) {
    if (!byName.has(hint.name)) byName.set(hint.name, hint);
  }
  return Array.from(byName.values());
}

function deriveRisks(discovery: DiscoveryResult): RiskNote[] {
  const risks: RiskNote[] = [];

  const tenantFeature = discovery.features.includes("multi-tenant");
  const tenantScopedEndpoints = discovery.apiEndpoints.filter((e) => e.tenantScoped);
  if (tenantFeature && tenantScopedEndpoints.length === 0 && discovery.apiEndpoints.length > 0) {
    risks.push({
      severity: "high",
      message:
        "App looks multi-tenant but no endpoint appears tenant-scoped. Tenant isolation must be verified carefully.",
    });
  }

  const unguarded = discovery.apiEndpoints.filter(
    (e) => !e.authGuarded && /order|customer|payment|admin|tenant/i.test(e.path),
  );
  if (unguarded.length > 0) {
    risks.push({
      severity: "high",
      message: `${unguarded.length} sensitive endpoint(s) show no obvious auth guard — confirm protection (e.g. ${unguarded[0]!.method} ${unguarded[0]!.path}).`,
      source: unguarded[0]!.source,
    });
  }

  if (discovery.features.includes("ordering") && !discovery.features.includes("authentication")) {
    risks.push({
      severity: "medium",
      message: "Ordering detected but authentication was not — confirm whether checkout requires login.",
    });
  }

  return risks;
}

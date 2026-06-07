import type { AppKnowledgeGraph } from "../knowledge/types.js";
import type { QaReport, ScenarioResult } from "../reporting/types.js";
import { classifyFailure } from "../reporting/SeverityClassifier.js";

export interface FailureAnalysis {
  severity: string;
  suspectedRootCause: string;
  recommendedFix: string;
}

/**
 * Pluggable analyzer. v1 ships a deterministic, rule-based implementation; the
 * interface is designed so an LLM-backed analyzer can be dropped in later
 * without touching the runner or reporters.
 */
export interface AiAnalyzer {
  analyzeFailure(result: ScenarioResult): FailureAnalysis;
  analyzeDiscovery(graph: AppKnowledgeGraph): string[];
  suggestScenarios(graph: AppKnowledgeGraph): string[];
  summarizeReport(report: QaReport): string;
}

/** Deterministic analyzer used by default — no external API calls. */
export class RuleBasedAiAnalyzer implements AiAnalyzer {
  analyzeFailure(result: ScenarioResult): FailureAnalysis {
    return classifyFailure(result);
  }

  analyzeDiscovery(graph: AppKnowledgeGraph): string[] {
    const notes: string[] = [];
    if (graph.features.includes("multi-tenant")) {
      notes.push("Multi-tenant app detected — prioritize tenant isolation testing.");
    }
    if (graph.features.includes("ordering") && !graph.features.includes("authentication")) {
      notes.push("Ordering without detected auth — confirm guest checkout is intended.");
    }
    if (Object.keys(graph.roles).length === 0) {
      notes.push("No roles detected — permission coverage will be limited.");
    }
    return notes;
  }

  suggestScenarios(graph: AppKnowledgeGraph): string[] {
    const ids: string[] = ["smoke.pages", "smoke.blankScreen"];
    if (graph.features.includes("authentication")) ids.push("auth.login");
    if (graph.features.includes("ordering")) {
      ids.push("ecommerce.customerCreateOrder", "ecommerce.merchantManageOrder", "ecommerce.orderLifecycle");
    }
    if (graph.features.includes("customer-blocking")) {
      ids.push("ecommerce.merchantBlockCustomer", "ecommerce.blockedCustomerCannotOrder");
    }
    if (graph.features.includes("permissions")) ids.push("security.rolePermissions", "security.unauthenticatedAccess");
    if (graph.features.includes("multi-tenant")) ids.push("security.tenantIsolation");
    return Array.from(new Set(ids));
  }

  summarizeReport(report: QaReport): string {
    const s = report.summary;
    const crit = report.scenarios.filter((x) => x.status === "failed" && x.severity === "critical").length;
    return `${s.passed}/${s.total} passed, ${s.failed} failed (${crit} critical), ${s.skipped} skipped, ${s.blocked} blocked.`;
  }
}

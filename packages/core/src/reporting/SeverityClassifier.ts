import type { ScenarioResult, Severity } from "./types.js";

/**
 * Maps a failed scenario to a severity and a best-effort root cause + fix,
 * using rule-based heuristics over the captured signals.
 */
export function classifyFailure(result: ScenarioResult): {
  severity: Severity;
  suspectedRootCause: string;
  recommendedFix: string;
} {
  const has500 = result.networkErrors.some((n) => (n.status ?? 0) >= 500);
  const reason = (result.failureReason ?? "").toLowerCase();
  const hasConsoleError = result.consoleErrors.length > 0;
  const blankScreen = /blank|empty page|no content|crash/.test(reason);
  const selectorMissing = /selector|locator|not found|no element|timeout.*waiting for/.test(reason);
  const redirect = /redirect|unexpected url|expected url|navigation/.test(reason);
  const tenant = result.tags.includes("multi-tenant") || /tenant|isolation|leak/.test(reason);
  const permission = result.tags.includes("permissions") || /permission|forbidden|403|unauthorized/.test(reason);

  if (tenant) {
    return {
      severity: "critical",
      suspectedRootCause: "Cross-tenant data exposure: a tenant could access another tenant's resource.",
      recommendedFix: "Enforce tenant scoping on both the API (server-side ownership check) and the UI route guard.",
    };
  }
  if (has500) {
    return {
      severity: "high",
      suspectedRootCause: "Backend/API error (HTTP 5xx) during the flow.",
      recommendedFix: "Inspect server logs for the failing request; fix the API handler and add error handling.",
    };
  }
  if (blankScreen && hasConsoleError) {
    return {
      severity: "high",
      suspectedRootCause: "Frontend crash: blank screen combined with console errors.",
      recommendedFix: "Check the console error stack; likely an unhandled exception during render.",
    };
  }
  if (permission) {
    return {
      severity: "high",
      suspectedRootCause: "Authorization issue: access control did not behave as expected.",
      recommendedFix: "Review route guards / RBAC middleware for the affected role.",
    };
  }
  if (redirect) {
    return {
      severity: "medium",
      suspectedRootCause: "Auth/navigation issue: an unexpected redirect occurred.",
      recommendedFix: "Verify login state and post-action navigation expectations.",
    };
  }
  if (selectorMissing) {
    return {
      severity: "medium",
      suspectedRootCause: "UI selector did not resolve — element missing, renamed, or page not ready.",
      recommendedFix: "Add a stable data-testid or update the selector hints in qa.config.ts.",
    };
  }
  return {
    severity: result.severity,
    suspectedRootCause: "Unclassified failure — see failure reason and artifacts.",
    recommendedFix: "Open the trace/screenshot to inspect the failing step.",
  };
}

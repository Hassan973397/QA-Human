import { test } from "node:test";
import assert from "node:assert/strict";
import { QaReporter, mergeReports } from "../src/reporting/QaReporter.js";
import { renderHtmlReport } from "../src/reporting/HtmlReporter.js";
import { renderJsonReport } from "../src/reporting/JsonReporter.js";

function makeReport(scenarios: Array<{ id: string; status: "passed" | "failed" | "skipped"; tags?: string[] }>) {
  const reporter = new QaReporter({ appName: "App", baseUrl: "http://localhost", environment: "local" });
  for (const s of scenarios) {
    const rep = reporter.startScenario({ id: s.id, title: s.id, severity: "medium", tags: s.tags ?? [] });
    const res = rep.finish(s.status, s.status === "failed" ? { failureReason: "boom" } : {});
    reporter.completeScenario(res);
  }
  return reporter.build();
}

test("QaReporter aggregates summary counts", () => {
  const report = makeReport([
    { id: "a", status: "passed" },
    { id: "b", status: "failed" },
    { id: "c", status: "skipped" },
  ]);
  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.passed, 1);
  assert.equal(report.summary.failed, 1);
  assert.equal(report.summary.skipped, 1);
});

test("a failed tenant-isolation scenario is classified critical", () => {
  const report = makeReport([{ id: "t", status: "failed", tags: ["multi-tenant"] }]);
  const sc = report.scenarios[0]!;
  assert.equal(sc.severity, "critical");
  assert.ok(sc.suspectedRootCause);
  assert.ok(sc.recommendedFix);
});

test("HTML report is self-contained and interactive", () => {
  const report = makeReport([
    { id: "a", status: "passed" },
    { id: "b", status: "failed" },
  ]);
  const html = renderHtmlReport(report);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("<svg"), "includes a chart");
  assert.ok(html.includes("data-filter"), "includes filter controls");
  assert.ok(html.includes("data-scenario"), "scenario cards are filterable");
  assert.ok(html.includes("<script>"), "includes client-side filtering");
  // no external resources (offline-friendly)
  assert.ok(!/src=["']https?:/.test(html) && !/href=["']https?:/.test(html));
});

test("JSON report round-trips to valid JSON", () => {
  const report = makeReport([{ id: "a", status: "passed" }]);
  const parsed = JSON.parse(renderJsonReport(report));
  assert.equal(parsed.summary.total, 1);
});

test("mergeReports combines scenarios and recomputes the summary", () => {
  const a = makeReport([{ id: "a", status: "passed" }]);
  const b = makeReport([
    { id: "b", status: "failed" },
    { id: "c", status: "passed" },
  ]);
  const merged = mergeReports([a, b]);
  assert.equal(merged.summary.total, 3);
  assert.equal(merged.summary.passed, 2);
  assert.equal(merged.summary.failed, 1);
  assert.equal(merged.scenarios.length, 3);
});

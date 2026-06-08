import { formatDuration } from "../utils/time.js";
import { gradeReport } from "./QaGrade.js";
import type { QaReport, ScenarioResult } from "./types.js";

const STATUS_EMOJI: Record<string, string> = {
  passed: "✅",
  failed: "❌",
  skipped: "⏭️",
  blocked: "🚫",
};

export function renderMarkdownReport(report: QaReport): string {
  const l: string[] = [];
  l.push(`# QA Report — ${report.appName}`);
  l.push("");
  const g = gradeReport(report);
  l.push(`## 🏅 QA Score: ${g.grade} (${g.score}/100)`);
  l.push(`> ${g.verdict}`);
  l.push("");
  l.push(`${g.failed} failed scenario(s) · ${g.security} security finding(s) · ${g.important} important review finding(s) · ${g.advisories} advisory.`);
  l.push("");
  l.push(`- Base URL: \`${report.baseUrl}\``);
  l.push(`- Environment: ${report.environment}`);
  l.push(`- Started: ${report.startedAt}`);
  l.push(`- Duration: ${formatDuration(report.durationMs)}`);
  l.push("");
  const s = report.summary;
  l.push(
    `**Summary:** ${s.total} total — ${STATUS_EMOJI.passed} ${s.passed} passed, ${STATUS_EMOJI.failed} ${s.failed} failed, ${STATUS_EMOJI.skipped} ${s.skipped} skipped, ${STATUS_EMOJI.blocked} ${s.blocked} blocked`,
  );

  if (report.discovery) {
    l.push("");
    l.push("## Discovery Summary");
    l.push(`- Frameworks: ${report.discovery.frameworks.join(", ") || "unknown"}`);
    l.push(`- Routes: ${report.discovery.routes}, API endpoints: ${report.discovery.apiEndpoints}`);
    l.push(`- Roles: ${report.discovery.roles.join(", ") || "none"}`);
    l.push(`- Features: ${report.discovery.features.join(", ") || "none"}`);
  }

  l.push(...renderPerformance(report));

  l.push("");
  l.push("## Scenarios");
  for (const sc of report.scenarios) l.push(...renderScenario(sc));

  l.push(...renderProductReview(report));

  if (report.securityFindings.length > 0) {
    l.push("");
    l.push("## 🔐 Security Findings");
    for (const f of report.securityFindings) {
      l.push(`- **[${f.severity}] ${f.kind}** (${f.scenarioId}): ${f.message}`);
    }
  }

  l.push("");
  l.push("## Unknowns");
  if (report.unknowns.length === 0) l.push("_None._");
  else for (const u of report.unknowns) l.push(`- ${u}`);

  l.push("");
  l.push("## Required Configuration");
  if (report.requiredConfig.length === 0) l.push("_Nothing missing._");
  else for (const r of report.requiredConfig) l.push(`- **${r.kind}**: ${r.message}`);

  return l.join("\n") + "\n";
}

function renderPerformance(report: QaReport): string[] {
  const metrics = report.scenarios.flatMap((s) => s.metrics);
  if (metrics.length === 0) return [];
  const slowest = [...metrics].sort((a, b) => b.loadMs - a.loadMs).slice(0, 10);
  const overBudget = metrics.filter((m) => m.overBudget);
  const l: string[] = ["", "## Performance"];
  l.push(`Captured ${metrics.length} page load(s).${overBudget.length ? ` ⚠ ${overBudget.length} over budget.` : ""}`);
  l.push("");
  l.push("Slowest pages:");
  for (const m of slowest) {
    l.push(`- ${m.loadMs}ms (ttfb ${m.ttfbMs}ms) — \`${m.url}\` [${m.role}]${m.overBudget ? " ⚠" : ""}`);
  }
  return l;
}

const DOMAIN_LABEL: Record<string, string> = {
  ux: "UX & structure",
  ui: "Design & visual quality",
  responsive: "Responsive layout",
  seo: "SEO & metadata",
  api: "Backend / API",
  links: "Links & assets",
  forms: "Form validation",
  code: "Code & backend (static)",
  content: "Content & i18n",
  performance: "Performance & Web Vitals",
  security: "Frontend security",
};

/** قسم مراجعة شاملة مجمّع حسب الطبقة ثم الصفحة، مرتّب بالخطورة. */
function renderProductReview(report: QaReport): string[] {
  const findings = report.scenarios.flatMap((s) => s.uxFindings).filter((f) => !f.category.endsWith("-more"));
  if (findings.length === 0) return [];
  const byDomain = new Map<string, typeof findings>();
  for (const f of findings) {
    const d = f.domain ?? "ux";
    const list = byDomain.get(d) ?? [];
    list.push(f);
    byDomain.set(d, list);
  }
  const high = findings.filter((f) => weight(f.severity) >= 3).length;
  const med = findings.filter((f) => f.severity === "medium").length;
  const l: string[] = ["", "## 🧐 Comprehensive Review (owner's eye)"];
  l.push(`${findings.length} observation(s) across ${byDomain.size} layer(s)${high ? ` — ${high} important` : ""}${med ? `, ${med} worth fixing` : ""}.`);
  for (const [domain, list] of byDomain) {
    l.push("");
    l.push(`### ${DOMAIN_LABEL[domain] ?? domain}`);
    const byScope = new Map<string, typeof list>();
    for (const f of list) {
      const s = byScope.get(f.scope) ?? [];
      s.push(f);
      byScope.set(f.scope, s);
    }
    for (const [scope, items] of byScope) {
      l.push(`- \`${scope}\``);
      for (const f of items.sort((a, b) => weight(b.severity) - weight(a.severity))) {
        l.push(`  - ${sev(f.severity)} **${f.title}** — ${f.detail}`);
        l.push(`    - 💡 ${f.suggestion}${f.selector ? ` (\`${f.selector}\`)` : ""}`);
      }
    }
  }
  return l;
}

function sev(s: string): string {
  return s === "critical" || s === "high" ? "🔴" : s === "medium" ? "🟠" : "🟡";
}
function weight(s: string): number {
  return s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1;
}

function renderScenario(sc: ScenarioResult): string[] {
  const l: string[] = [];
  l.push("");
  l.push(`### ${STATUS_EMOJI[sc.status] ?? ""} ${sc.title} \`(${sc.id})\`${sc.flaky ? " ⚠️ flaky" : ""}`);
  l.push(
    `- Status: **${sc.status}** | Severity: ${sc.severity} | Duration: ${formatDuration(sc.durationMs)}${sc.attempts > 0 ? ` | Retries: ${sc.attempts}` : ""}`,
  );
  if (sc.metrics.length) {
    const slow = [...sc.metrics].sort((a, b) => b.loadMs - a.loadMs)[0]!;
    l.push(`- Slowest load: ${slow.loadMs}ms (\`${slow.url}\`)`);
  }
  if (sc.rolesUsed.length) l.push(`- Roles: ${sc.rolesUsed.join(", ")}`);
  if (sc.tags.length) l.push(`- Tags: ${sc.tags.join(", ")}`);
  if (sc.skipReason) l.push(`- Skip reason: ${sc.skipReason}`);
  if (sc.failureReason) l.push(`- Failure: ${sc.failureReason}`);
  if (sc.suspectedRootCause) l.push(`- Suspected root cause: ${sc.suspectedRootCause}`);
  if (sc.recommendedFix) l.push(`- Recommended fix: ${sc.recommendedFix}`);

  if (sc.steps.length) {
    l.push("");
    l.push("Steps:");
    for (const step of sc.steps) {
      const emoji = step.status === "failed" ? "❌" : step.status === "passed" ? "✓" : "·";
      l.push(`  - ${emoji} ${step.title}${step.error ? ` — ${step.error}` : ""}`);
    }
  }

  if (sc.visualChecks.length) {
    const diffs = sc.visualChecks.filter((v) => v.status === "diff");
    l.push(
      `- Visual: ${sc.visualChecks.length} check(s)${diffs.length ? `, ${diffs.length} regression(s)` : ""}`,
    );
    for (const v of diffs) l.push(`  - ⚠ ${v.name}: ${(v.diffRatio * 100).toFixed(2)}% changed`);
  }
  if (sc.a11yViolations.length) {
    l.push(`- Accessibility: ${sc.a11yViolations.length} violation(s)`);
    for (const v of sc.a11yViolations.slice(0, 5)) {
      l.push(`  - [${v.impact}] ${v.id} — ${v.help} (${v.scope})`);
    }
  }
  if (sc.uxFindings.length) {
    const med = sc.uxFindings.filter((f) => f.severity === "medium").length;
    l.push(`- Product review: ${sc.uxFindings.length} finding(s)${med ? `, ${med} worth fixing` : ""}`);
  }
  if (sc.consoleErrors.length) {
    l.push(`- Console errors: ${sc.consoleErrors.length}`);
    for (const e of sc.consoleErrors.slice(0, 5)) l.push(`  - ${e.text}`);
  }
  if (sc.networkErrors.length) {
    l.push(`- Network errors: ${sc.networkErrors.length}`);
    for (const e of sc.networkErrors.slice(0, 5)) {
      l.push(`  - ${e.method ?? ""} ${e.url} → ${e.status ?? e.failure ?? "failed"}`);
    }
  }
  if (sc.artifacts.length) {
    l.push("- Artifacts:");
    for (const a of sc.artifacts) l.push(`  - ${a.type}: \`${a.path}\``);
  }
  return l;
}

import { formatDuration } from "../utils/time.js";
import type { QaReport, ScenarioResult } from "./types.js";

const STATUS_COLOR: Record<string, string> = {
  passed: "#16a34a",
  failed: "#dc2626",
  skipped: "#a16207",
  blocked: "#6b7280",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderHtmlReport(report: QaReport): string {
  const s = report.summary;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>QA Report — ${esc(report.appName)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; background:#0b0f14; color:#e6edf3; }
  .wrap { max-width: 1000px; margin: 0 auto; padding: 24px; }
  h1 { margin: 0 0 4px; }
  .muted { color:#9aa7b4; font-size: 14px; }
  .cards { display:flex; gap:12px; flex-wrap:wrap; margin:20px 0; }
  .card { background:#131a22; border:1px solid #1f2933; border-radius:10px; padding:14px 18px; min-width:110px; }
  .card .n { font-size:26px; font-weight:700; }
  .scenario { background:#131a22; border:1px solid #1f2933; border-radius:10px; padding:16px; margin:12px 0; }
  .badge { display:inline-block; padding:2px 10px; border-radius:999px; color:#fff; font-size:12px; font-weight:600; }
  .step { padding:3px 0; font-size:14px; border-bottom:1px dashed #1f2933; }
  .step.failed { color:#fca5a5; }
  code { background:#0b0f14; padding:1px 6px; border-radius:6px; }
  details { margin-top:8px; } summary { cursor:pointer; }
  .err { color:#fca5a5; font-size:13px; }
  a { color:#60a5fa; }
</style>
</head>
<body><div class="wrap">
  <h1>QA Report — ${esc(report.appName)}</h1>
  <div class="muted">${esc(report.baseUrl)} · ${esc(report.environment)} · ${esc(report.startedAt)} · ${formatDuration(report.durationMs)}</div>
  <div class="cards">
    ${card("Total", s.total, "#3b82f6")}
    ${card("Passed", s.passed, STATUS_COLOR.passed!)}
    ${card("Failed", s.failed, STATUS_COLOR.failed!)}
    ${card("Skipped", s.skipped, STATUS_COLOR.skipped!)}
    ${card("Blocked", s.blocked, STATUS_COLOR.blocked!)}
  </div>
  ${report.discovery ? discoveryBlock(report) : ""}
  <h2>Scenarios</h2>
  ${report.scenarios.map(scenarioBlock).join("\n")}
  ${securityBlock(report)}
  ${listBlock("Unknowns", report.unknowns)}
  ${listBlock("Required Configuration", report.requiredConfig.map((r) => `${r.kind}: ${r.message}`))}
</div></body></html>`;
}

function card(label: string, n: number, color: string): string {
  return `<div class="card"><div class="n" style="color:${color}">${n}</div><div class="muted">${label}</div></div>`;
}

function discoveryBlock(report: QaReport): string {
  const d = report.discovery!;
  return `<div class="scenario"><strong>Discovery</strong><div class="muted">
    Frameworks: ${esc(d.frameworks.join(", ") || "unknown")} ·
    Routes: ${d.routes} · API: ${d.apiEndpoints} ·
    Roles: ${esc(d.roles.join(", ") || "none")} ·
    Features: ${esc(d.features.join(", ") || "none")}</div></div>`;
}

function scenarioBlock(sc: ScenarioResult): string {
  const color = STATUS_COLOR[sc.status] ?? "#6b7280";
  const steps = sc.steps
    .map(
      (st) =>
        `<div class="step ${st.status}">${st.status === "failed" ? "✗" : st.status === "passed" ? "✓" : "·"} ${esc(st.title)}${st.error ? ` — <span class="err">${esc(st.error)}</span>` : ""}</div>`,
    )
    .join("");
  const meta: string[] = [];
  if (sc.failureReason) meta.push(`<div class="err">Failure: ${esc(sc.failureReason)}</div>`);
  if (sc.skipReason) meta.push(`<div class="muted">Skip: ${esc(sc.skipReason)}</div>`);
  if (sc.suspectedRootCause) meta.push(`<div class="muted">Root cause: ${esc(sc.suspectedRootCause)}</div>`);
  if (sc.recommendedFix) meta.push(`<div class="muted">Fix: ${esc(sc.recommendedFix)}</div>`);
  const artifacts = sc.artifacts
    .map((a) => `<a href="${esc(a.path)}">${a.type}</a>`)
    .join(" · ");
  return `<div class="scenario">
    <div><span class="badge" style="background:${color}">${sc.status}</span>
    <strong> ${esc(sc.title)}</strong> <code>${esc(sc.id)}</code></div>
    <div class="muted">severity: ${sc.severity} · ${formatDuration(sc.durationMs)} · roles: ${esc(sc.rolesUsed.join(", ") || "—")}</div>
    ${meta.join("")}
    <details><summary>${sc.steps.length} steps</summary>${steps}</details>
    ${artifacts ? `<div class="muted">Artifacts: ${artifacts}</div>` : ""}
  </div>`;
}

function securityBlock(report: QaReport): string {
  if (report.securityFindings.length === 0) return "";
  const items = report.securityFindings
    .map((f) => `<li><strong>[${f.severity}] ${esc(f.kind)}</strong> (${esc(f.scenarioId)}): ${esc(f.message)}</li>`)
    .join("");
  return `<h2>🔐 Security Findings</h2><ul>${items}</ul>`;
}

function listBlock(title: string, items: string[]): string {
  if (items.length === 0) return `<h2>${title}</h2><p class="muted">None.</p>`;
  return `<h2>${title}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

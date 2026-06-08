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
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; background:#0b0f14; color:#e6edf3; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 24px; }
  h1 { margin: 0 0 4px; }
  h2 { margin-top: 28px; }
  .muted { color:#9aa7b4; font-size: 14px; }
  .top { display:flex; gap:24px; flex-wrap:wrap; align-items:center; margin:20px 0; }
  .cards { display:flex; gap:10px; flex-wrap:wrap; }
  .card { background:#131a22; border:1px solid #1f2933; border-radius:10px; padding:12px 16px; min-width:96px; cursor:pointer; transition:border-color .15s, transform .05s; }
  .card:hover { border-color:#2f3b49; }
  .card.active { border-color:#60a5fa; box-shadow:0 0 0 1px #60a5fa inset; }
  .card .n { font-size:24px; font-weight:700; }
  .card .l { font-size:12px; }
  .scenario { background:#131a22; border:1px solid #1f2933; border-radius:10px; padding:16px; margin:12px 0; }
  .badge { display:inline-block; padding:2px 10px; border-radius:999px; color:#fff; font-size:12px; font-weight:600; }
  .step { padding:3px 0; font-size:14px; border-bottom:1px dashed #1f2933; }
  .step.failed { color:#fca5a5; }
  code { background:#0b0f14; padding:1px 6px; border-radius:6px; }
  details { margin-top:8px; } summary { cursor:pointer; }
  .err { color:#fca5a5; font-size:13px; }
  a { color:#60a5fa; }
  .toolbar { display:flex; gap:10px; align-items:center; margin:8px 0 4px; flex-wrap:wrap; }
  input[type=search] { background:#0b0f14; border:1px solid #1f2933; border-radius:8px; color:#e6edf3; padding:8px 12px; min-width:220px; }
  .bar-row { display:flex; align-items:center; gap:10px; font-size:13px; margin:4px 0; }
  .bar-track { flex:1; background:#0b0f14; border-radius:6px; height:14px; overflow:hidden; border:1px solid #1f2933; }
  .bar-fill { height:100%; background:linear-gradient(90deg,#3b82f6,#60a5fa); }
  .bar-row.over .bar-fill { background:linear-gradient(90deg,#dc2626,#fca5a5); }
  .legend { display:flex; gap:14px; flex-wrap:wrap; font-size:13px; }
  .legend span::before { content:"●"; margin-right:5px; }
  .hidden { display:none !important; }
</style>
</head>
<body><div class="wrap">
  <h1>QA Report — ${esc(report.appName)}</h1>
  <div class="muted">${esc(report.baseUrl)} · ${esc(report.environment)} · ${esc(report.startedAt)} · ${formatDuration(report.durationMs)}</div>

  <div class="top">
    ${donut(s)}
    <div>
      <div class="cards">
        ${card("Total", s.total, "#3b82f6", "all")}
        ${card("Passed", s.passed, STATUS_COLOR.passed!, "passed")}
        ${card("Failed", s.failed, STATUS_COLOR.failed!, "failed")}
        ${card("Skipped", s.skipped, STATUS_COLOR.skipped!, "skipped")}
        ${card("Blocked", s.blocked, STATUS_COLOR.blocked!, "blocked")}
      </div>
      <div class="muted" style="margin-top:8px">Click a card or chart legend to filter scenarios.</div>
    </div>
  </div>

  ${report.discovery ? discoveryBlock(report) : ""}
  ${performanceBlock(report)}

  <h2>Scenarios</h2>
  <div class="toolbar">
    <input id="search" type="search" placeholder="Filter scenarios by id or title…" />
    <span class="muted" id="count"></span>
  </div>
  <div id="scenarios">
    ${report.scenarios.map(scenarioBlock).join("\n")}
  </div>

  ${productReviewBlock(report)}
  ${securityBlock(report)}
  ${listBlock("Unknowns", report.unknowns)}
  ${listBlock("Required Configuration", report.requiredConfig.map((r) => `${r.kind}: ${r.message}`))}
</div>
${filterScript()}
</body></html>`;
}

/** SVG donut chart of the status breakdown, built from stacked stroked circles. */
function donut(s: QaReport["summary"]): string {
  const segments: Array<[string, number, string]> = [
    ["passed", s.passed, STATUS_COLOR.passed!],
    ["failed", s.failed, STATUS_COLOR.failed!],
    ["skipped", s.skipped, STATUS_COLOR.skipped!],
    ["blocked", s.blocked, STATUS_COLOR.blocked!],
  ];
  const total = s.total || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const circles = segments
    .filter(([, v]) => v > 0)
    .map(([, v, color]) => {
      const len = (v / total) * c;
      const circle = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 70 70)" />`;
      offset += len;
      return circle;
    })
    .join("");
  const legend = segments
    .map(([label, v, color]) => `<span style="color:${color}">${label} ${v}</span>`)
    .join("");
  const passRate = s.total ? Math.round((s.passed / s.total) * 100) : 0;
  return `<div>
    <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="status donut">
      <circle cx="70" cy="70" r="54" fill="none" stroke="#1f2933" stroke-width="16" />
      ${circles}
      <text x="70" y="66" text-anchor="middle" font-size="26" font-weight="700" fill="#e6edf3">${passRate}%</text>
      <text x="70" y="86" text-anchor="middle" font-size="11" fill="#9aa7b4">pass rate</text>
    </svg>
    <div class="legend" style="max-width:160px">${legend}</div>
  </div>`;
}

function card(label: string, n: number, color: string, filter: string): string {
  return `<div class="card${filter === "all" ? " active" : ""}" data-filter="${filter}"><div class="n" style="color:${color}">${n}</div><div class="l muted">${label}</div></div>`;
}

function discoveryBlock(report: QaReport): string {
  const d = report.discovery!;
  return `<div class="scenario"><strong>Discovery</strong><div class="muted">
    Frameworks: ${esc(d.frameworks.join(", ") || "unknown")} ·
    Routes: ${d.routes} · API: ${d.apiEndpoints} ·
    Roles: ${esc(d.roles.join(", ") || "none")} ·
    Features: ${esc(d.features.join(", ") || "none")}</div></div>`;
}

/** Horizontal bar chart of the slowest page loads captured across all scenarios. */
function performanceBlock(report: QaReport): string {
  const metrics = report.scenarios.flatMap((sc) => sc.metrics);
  if (metrics.length === 0) return "";
  const slowest = [...metrics].sort((a, b) => b.loadMs - a.loadMs).slice(0, 8);
  const max = slowest[0]!.loadMs || 1;
  const rows = slowest
    .map((m) => {
      const pct = Math.max(3, Math.round((m.loadMs / max) * 100));
      return `<div class="bar-row${m.overBudget ? " over" : ""}">
        <div style="flex:1;min-width:0"><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>
        <div style="width:80px;text-align:right">${m.loadMs}ms</div>
        <div class="muted" style="width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(m.url)}">${esc(shortUrl(m.url))}</div>
      </div>`;
    })
    .join("");
  return `<h2>Performance</h2><div class="scenario">${rows}</div>`;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
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
  if (sc.flaky) meta.push(`<div class="muted">⚠️ Flaky — passed after ${sc.attempts} retry(ies)</div>`);
  if (sc.metrics.length) {
    const slow = [...sc.metrics].sort((a, b) => b.loadMs - a.loadMs)[0]!;
    meta.push(
      `<div class="muted">Perf: slowest load ${slow.loadMs}ms (ttfb ${slow.ttfbMs}ms)${slow.overBudget ? " ⚠ over budget" : ""}</div>`,
    );
  }
  const visualDiffs = sc.visualChecks.filter((v) => v.status === "diff");
  if (sc.visualChecks.length) {
    meta.push(
      `<div class="muted">Visual: ${sc.visualChecks.length} check(s)${visualDiffs.length ? ` · <span class="err">${visualDiffs.length} regression(s)</span>` : ""}</div>`,
    );
  }
  if (sc.a11yViolations.length) {
    const top = sc.a11yViolations
      .slice(0, 3)
      .map((v) => `${esc(v.id)} (${esc(v.impact)})`)
      .join(", ");
    meta.push(`<div class="muted">A11y: ${sc.a11yViolations.length} violation(s) — ${top}</div>`);
  }
  if (sc.uxFindings.length) {
    const med = sc.uxFindings.filter((f) => f.severity === "medium").length;
    meta.push(
      `<div class="muted">Product review: ${sc.uxFindings.length} finding(s)${med ? ` · ${med} worth fixing` : ""}</div>`,
    );
  }
  if (sc.failureReason) meta.push(`<div class="err">Failure: ${esc(sc.failureReason)}</div>`);
  if (sc.skipReason) meta.push(`<div class="muted">Skip: ${esc(sc.skipReason)}</div>`);
  if (sc.suspectedRootCause) meta.push(`<div class="muted">Root cause: ${esc(sc.suspectedRootCause)}</div>`);
  if (sc.recommendedFix) meta.push(`<div class="muted">Fix: ${esc(sc.recommendedFix)}</div>`);
  const artifacts = sc.artifacts
    .map((a) => `<a href="${esc(a.path)}">${a.type}</a>`)
    .join(" · ");
  const haystack = esc(`${sc.id} ${sc.title} ${sc.tags.join(" ")}`.toLowerCase());
  return `<div class="scenario" data-scenario data-status="${sc.status}" data-search="${haystack}">
    <div><span class="badge" style="background:${color}">${sc.status}</span>
    <strong> ${esc(sc.title)}</strong> <code>${esc(sc.id)}</code></div>
    <div class="muted">severity: ${sc.severity} · ${formatDuration(sc.durationMs)} · roles: ${esc(sc.rolesUsed.join(", ") || "—")}</div>
    ${meta.join("")}
    <details><summary>${sc.steps.length} steps</summary>${steps}</details>
    ${artifacts ? `<div class="muted">Artifacts: ${artifacts}</div>` : ""}
  </div>`;
}

const DOMAIN_LABEL: Record<string, string> = {
  ux: "UX & structure",
  ui: "Design & visual quality",
  responsive: "Responsive layout",
  seo: "SEO & metadata",
  api: "Backend / API",
  links: "Links & assets",
};

/** قسم «مراجعة شاملة» — ملاحظات مجمّعة حسب الطبقة ثم الصفحة. */
function productReviewBlock(report: QaReport): string {
  const findings = report.scenarios
    .flatMap((s) => s.uxFindings)
    .filter((f) => !f.category.endsWith("-more"));
  if (findings.length === 0) return "";
  const w = (s: string): number => (s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1);
  const sevDot = (s: string): string =>
    `<span style="color:${w(s) >= 3 ? "#dc2626" : s === "medium" ? "#f59e0b" : "#eab308"}">●</span>`;
  const byDomain = new Map<string, typeof findings>();
  for (const f of findings) {
    const d = f.domain ?? "ux";
    const list = byDomain.get(d) ?? [];
    list.push(f);
    byDomain.set(d, list);
  }
  const high = findings.filter((f) => w(f.severity) >= 3).length;
  const med = findings.filter((f) => f.severity === "medium").length;
  const blocks = Array.from(byDomain.entries())
    .map(([domain, list]) => {
      const byScope = new Map<string, typeof list>();
      for (const f of list) {
        const s = byScope.get(f.scope) ?? [];
        s.push(f);
        byScope.set(f.scope, s);
      }
      const scopes = Array.from(byScope.entries())
        .map(([scope, items]) => {
          const lis = items
            .sort((a, b) => w(b.severity) - w(a.severity))
            .map(
              (f) =>
                `<li>${sevDot(f.severity)} <strong>${esc(f.title)}</strong> — ${esc(f.detail)}<br>
                 <span class="muted">💡 ${esc(f.suggestion)}${f.selector ? ` <code>${esc(f.selector)}</code>` : ""}</span></li>`,
            )
            .join("");
          return `<div class="muted" style="margin-top:6px"><code>${esc(scope)}</code></div><ul>${lis}</ul>`;
        })
        .join("");
      return `<div class="scenario"><strong>${esc(DOMAIN_LABEL[domain] ?? domain)}</strong> <span class="muted">(${list.length})</span>${scopes}</div>`;
    })
    .join("");
  return `<h2>🧐 Comprehensive Review <span class="muted" style="font-size:14px">— owner's eye across every layer</span></h2>
    <div class="muted">${findings.length} observation(s) across ${byDomain.size} layer(s)${high ? ` · ${high} important` : ""}${med ? ` · ${med} worth fixing` : ""}.</div>
    ${blocks}`;
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

/** Self-contained vanilla-JS filtering + search (no external dependencies). */
function filterScript(): string {
  return `<script>
(function(){
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-scenario]'));
  var search = document.getElementById('search');
  var count = document.getElementById('count');
  var filters = Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));
  var status = 'all';
  function apply(){
    var q = (search && search.value || '').toLowerCase();
    var shown = 0;
    cards.forEach(function(c){
      var okStatus = status === 'all' || c.getAttribute('data-status') === status;
      var okQuery = !q || c.getAttribute('data-search').indexOf(q) !== -1;
      var show = okStatus && okQuery;
      c.classList.toggle('hidden', !show);
      if (show) shown++;
    });
    if (count) count.textContent = shown + ' / ' + cards.length + ' shown';
  }
  filters.forEach(function(b){
    b.addEventListener('click', function(){
      status = b.getAttribute('data-filter');
      filters.forEach(function(x){ x.classList.toggle('active', x === b); });
      apply();
    });
  });
  if (search) search.addEventListener('input', apply);
  apply();
})();
</script>`;
}

import type { AppKnowledgeGraph } from "../knowledge/types.js";

/** Renders a human-readable discovery report (markdown) from the knowledge graph. */
export function renderDiscoveryReport(graph: AppKnowledgeGraph): string {
  const lines: string[] = [];
  const h = (t: string) => lines.push(`\n## ${t}\n`);

  lines.push(`# Discovery Report — ${graph.app.name}`);
  lines.push("");
  lines.push(`- Generated: ${graph.generatedAt}`);
  lines.push(`- Base URL: ${graph.app.baseUrl}`);
  lines.push(`- App type: ${graph.app.type}`);
  lines.push(`- Frameworks: ${graph.frameworks.join(", ") || "unknown"}`);
  lines.push(`- Package manager: ${graph.packageManager}`);
  lines.push(`- Files scanned: ${graph.stats.filesScanned} (in ${graph.stats.durationMs}ms)`);

  h("Detected Scripts");
  const scriptKeys = Object.keys(graph.scripts);
  if (scriptKeys.length === 0) lines.push("_None detected._");
  else for (const k of scriptKeys) lines.push(`- \`${k}\`: \`${graph.scripts[k]}\``);

  h(`Routes (${graph.routes.length})`);
  if (graph.routes.length === 0) lines.push("_None detected._");
  else
    for (const r of graph.routes.slice(0, 80)) {
      lines.push(`- \`${r.path}\` _(${r.kind})_ — ${r.source}`);
    }

  h(`Forms (${graph.forms.length})`);
  if (graph.forms.length === 0) lines.push("_None detected._");
  else
    for (const f of graph.forms.slice(0, 40)) {
      lines.push(
        `- **${f.purpose ?? "form"}** — ${f.fields.length} field(s), submit: "${f.submitText ?? "?"}" — ${f.source}`,
      );
    }

  h(`API Endpoints (${graph.apiEndpoints.length})`);
  if (graph.apiEndpoints.length === 0) lines.push("_None detected._");
  else
    for (const e of graph.apiEndpoints.slice(0, 80)) {
      const flags = [e.authGuarded ? "auth" : null, e.tenantScoped ? "tenant" : null]
        .filter(Boolean)
        .join(",");
      lines.push(`- \`${e.method} ${e.path}\`${flags ? ` _(${flags})_` : ""}`);
    }

  h(`Roles (${Object.keys(graph.roles).length})`);
  if (Object.keys(graph.roles).length === 0) lines.push("_None detected._");
  else
    for (const [role, caps] of Object.entries(graph.roles)) {
      lines.push(`- **${role}**`);
      lines.push(`  - can: ${caps.can.join(", ") || "—"}`);
      lines.push(`  - cannot: ${caps.cannot.join(", ") || "—"}`);
    }

  h(`Workflows (${graph.workflows.length})`);
  if (graph.workflows.length === 0) lines.push("_None detected._");
  else
    for (const w of graph.workflows) {
      lines.push(`- **${w.name}** _(confidence: ${w.confidence})_`);
      for (const s of w.steps) lines.push(`  - ${s.description}`);
    }

  h(`Features`);
  lines.push(graph.features.map((f) => `\`${f}\``).join(", ") || "_None detected._");

  h(`Selector Hints`);
  lines.push(`Detected ${graph.selectors.length} selector hint(s) from data-testid / aria-label / name / placeholder.`);

  if (graph.risks.length > 0) {
    h("Risks");
    for (const r of graph.risks) lines.push(`- [${r.severity}] ${r.message}`);
  }

  h("Unknowns / Needs Configuration");
  if (graph.unknowns.length === 0) lines.push("_Nothing flagged._");
  else for (const u of graph.unknowns) lines.push(`- ${u}`);

  return lines.join("\n") + "\n";
}

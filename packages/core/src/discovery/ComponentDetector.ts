import type { SelectorHint } from "../knowledge/types.js";
import type { DetectorContext } from "./types.js";

/**
 * Harvests selector hints from the UI: data-testid, aria-label, input names and
 * placeholders. These feed the SelectorRegistry so human agents can find
 * elements even when the config has no explicit selector.
 */
export function detectComponents(ctx: DetectorContext): SelectorHint[] {
  const testIds = new Set<string>();
  const ariaLabels = new Set<string>();
  const names = new Set<string>();
  const placeholders = new Set<string>();

  for (const file of ctx.files) {
    if (!/\.(t|j)sx?|\.html|\.vue$/.test(file.relPath)) continue;
    collect(file.content, /data-testid\s*=\s*["'`]([^"'`{}]+)["'`]/g, testIds);
    collect(file.content, /aria-label\s*=\s*["'`]([^"'`{}]+)["'`]/g, ariaLabels);
    collect(file.content, /\bname\s*=\s*["'`]([^"'`{}]+)["'`]/g, names);
    collect(file.content, /placeholder\s*=\s*["'`]([^"'`{}]+)["'`]/g, placeholders);
  }

  const hints: SelectorHint[] = [];
  for (const id of testIds) {
    hints.push({ name: id, candidates: [`[data-testid="${id}"]`], source: "discovery" });
  }
  for (const label of ariaLabels) {
    hints.push({ name: label, candidates: [`[aria-label="${label}"]`], source: "discovery" });
  }
  for (const n of names) {
    hints.push({ name: n, candidates: [`[name="${n}"]`], source: "discovery" });
  }
  for (const p of placeholders) {
    hints.push({ name: p, candidates: [`[placeholder="${p}"]`], source: "discovery" });
  }
  return hints;
}

function collect(content: string, re: RegExp, set: Set<string>): void {
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const v = (m[1] ?? "").trim();
    if (v && v.length <= 80) set.add(v);
  }
}

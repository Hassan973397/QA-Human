import type { Page } from "playwright";
import axe from "axe-core";

export type ImpactLevel = "minor" | "moderate" | "serious" | "critical";

export interface A11yViolationNode {
  target: string;
  html: string;
}

export interface A11yViolationResult {
  id: string;
  impact: ImpactLevel | "none";
  help: string;
  helpUrl: string;
  nodes: A11yViolationNode[];
}

const IMPACT_ORDER: Record<string, number> = {
  none: 0,
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

export function impactAtLeast(impact: string, threshold: string): boolean {
  return (IMPACT_ORDER[impact] ?? 0) >= (IMPACT_ORDER[threshold] ?? 99);
}

/**
 * Injects axe-core into the page and runs an accessibility audit, returning the
 * violations. Runs entirely in-page; no network access required.
 */
export async function runAxeAudit(page: Page): Promise<A11yViolationResult[]> {
  // Inject the axe-core library source into the page, then run it there.
  await page.evaluate(axe.source);
  const raw = await page.evaluate(async () => {
    const runner = (window as unknown as { axe: typeof axe }).axe;
    const results = await runner.run(document, {
      resultTypes: ["violations"],
      reporter: "v2",
    });
    return results.violations.map((v) => ({
      id: v.id,
      impact: (v.impact ?? "none") as A11yViolationResult["impact"],
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.slice(0, 5).map((n) => ({
        target: (n.target as unknown as string[]).join(" "),
        html: (n.html ?? "").slice(0, 200),
      })),
    }));
  });
  return raw as A11yViolationResult[];
}

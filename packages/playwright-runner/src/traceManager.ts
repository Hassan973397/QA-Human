import path from "node:path";
import type { BrowserContext } from "playwright";
import type { BrowserConfig } from "@hasan-qa-humans/core";
import { ensureDir, pathExists } from "@hasan-qa-humans/core";

/** Starts tracing on a context when the trace policy calls for it. */
export async function startTrace(context: BrowserContext, browser: BrowserConfig): Promise<boolean> {
  if (browser.trace === "off") return false;
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  return true;
}

/**
 * Stops tracing, persisting the trace file only when the policy + outcome agree
 * (always for "on", only on failure for "retain-on-failure"). Returns the saved
 * file path, or null if no trace was kept.
 */
export async function stopTrace(
  context: BrowserContext,
  browser: BrowserConfig,
  tracesDir: string,
  scenarioId: string,
  role: string,
  failed: boolean,
): Promise<string | null> {
  if (browser.trace === "off") return null;
  // trace is "on" | "retain-on-failure" | "on-first-retry" here; all but "on"
  // are failure-gated, so keep when always-on or when the scenario failed.
  const keep = browser.trace === "on" || failed;
  if (!keep) {
    await context.tracing.stop().catch(() => undefined);
    return null;
  }
  await ensureDir(tracesDir);
  const file = path.join(tracesDir, `${scenarioId}-${role}.zip`);
  await context.tracing.stop({ path: file }).catch(() => undefined);
  return (await pathExists(file)) ? file : null;
}

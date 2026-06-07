import type { Page } from "playwright";

export interface CheckResult {
  ok: boolean;
  reason?: string;
}

const CRASH_MARKERS = [
  "Application error: a client-side exception",
  "Internal Server Error",
  "This page isn't working",
  "Cannot GET",
  "500: Internal",
  "Something went wrong",
];

/**
 * Detects a "blank screen": effectively no rendered text and a near-empty app
 * root. This catches white-screen-of-death style frontend crashes.
 */
export async function checkNoBlankScreen(page: Page): Promise<CheckResult> {
  try {
    const info = await page.evaluate(() => {
      const root =
        document.querySelector("#root, #app, #__next, main, [data-reactroot]") ?? document.body;
      const text = (document.body?.innerText ?? "").trim();
      const html = (root?.innerHTML ?? "").trim();
      return { textLen: text.length, htmlLen: html.length, title: document.title };
    });
    if (info.textLen < 2 && info.htmlLen < 40) {
      return { ok: false, reason: "Blank screen: page rendered effectively no content." };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `Could not evaluate page content: ${(error as Error).message}` };
  }
}

/** Looks for well-known crash/error banners in the rendered text. */
export async function checkNoCrashBanner(page: Page): Promise<CheckResult> {
  try {
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const marker = CRASH_MARKERS.find((m) => text.includes(m));
    return marker ? { ok: false, reason: `Crash/error banner detected: "${marker}"` } : { ok: true };
  } catch {
    return { ok: true };
  }
}

/** Waits for the network to be reasonably idle and the DOM to be ready. */
export async function waitForStablePage(
  page: Page,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
  } catch {
    // ignore — best effort
  }
  try {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  } catch {
    // networkidle can legitimately never settle (polling); don't fail here.
  }
}

import type { Page } from "playwright";

/**
 * Engine-side stability helper used around navigation. Mirrors the core
 * HumanAssertions.waitForStablePage but lives here so the engine has no need to
 * reach into human-level logic.
 */
export async function settle(page: Page, timeoutMs = 10000): Promise<void> {
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
  } catch {
    /* best effort */
  }
}

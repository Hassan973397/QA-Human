import type { Locator, Page } from "playwright";
import { SelectorRegistry } from "./SelectorRegistry.js";
import { looksLikeSelector, hintsForLabel } from "./selectorHints.js";

/**
 * Resolves a "selector name or raw locator" into the first matching Playwright
 * Locator by trying candidate selectors in priority order. This is what lets
 * scenarios be written against logical names (e.g. "loginButton") while still
 * working against a wide range of real markup.
 */
export class SelectorResolver {
  constructor(private readonly registry: SelectorRegistry) {}

  /** Build the ordered candidate list for a given input. */
  candidatesFor(nameOrSelector: string): string[] {
    const named = this.registry.candidates(nameOrSelector);
    if (named && named.length > 0) return named;
    if (looksLikeSelector(nameOrSelector)) return [nameOrSelector];
    // treat as a label/key and synthesize hints
    return hintsForLabel(nameOrSelector);
  }

  /**
   * Returns the first candidate locator that resolves to at least one element
   * within the timeout, or throws a descriptive error listing what was tried.
   */
  async resolve(page: Page, nameOrSelector: string, timeoutMs = 8000): Promise<Locator> {
    const candidates = this.candidatesFor(nameOrSelector);
    const deadline = Date.now() + timeoutMs;
    let lastError = "";

    while (Date.now() < deadline) {
      for (const candidate of candidates) {
        try {
          const locator = page.locator(candidate).first();
          if ((await locator.count()) > 0) return locator;
        } catch (error) {
          lastError = (error as Error).message;
        }
      }
      await page.waitForTimeout(150);
    }

    throw new Error(
      `Selector "${nameOrSelector}" not found. Tried: ${candidates.join(" | ")}${lastError ? ` (last error: ${lastError})` : ""}`,
    );
  }

  /** Like resolve but returns null instead of throwing — for optional elements. */
  async tryResolve(page: Page, nameOrSelector: string, timeoutMs = 2000): Promise<Locator | null> {
    try {
      return await this.resolve(page, nameOrSelector, timeoutMs);
    } catch {
      return null;
    }
  }
}

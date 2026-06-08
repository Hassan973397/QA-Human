import type { Locator, Page } from "playwright";
import { SelectorRegistry } from "./SelectorRegistry.js";
import { looksLikeSelector, hintsForLabel } from "./selectorHints.js";

export interface HealingEvent {
  /** The logical name or raw input requested. */
  name: string;
  /** The candidate selector that actually matched. */
  used: string;
  /** The preferred (first) candidate that was expected to match. */
  primary: string;
  /** Whether the name was a registered selector (vs. a synthesized guess). */
  registered: boolean;
}

export type HealingCallback = (event: HealingEvent) => void;

/**
 * Resolves a "selector name or raw locator" into the first matching Playwright
 * Locator by trying candidate selectors in priority order. When the primary
 * candidate fails but a fallback succeeds (selector drift), it emits a healing
 * event so the report can suggest a stable selector — the app keeps testing
 * instead of breaking on a renamed element.
 */
export class SelectorResolver {
  constructor(
    private readonly registry: SelectorRegistry,
    private readonly onHeal?: HealingCallback,
  ) {}

  candidatesFor(nameOrSelector: string): string[] {
    const named = this.registry.candidates(nameOrSelector);
    if (named && named.length > 0) return named;
    if (looksLikeSelector(nameOrSelector)) return [nameOrSelector];
    return hintsForLabel(nameOrSelector);
  }

  async resolve(page: Page, nameOrSelector: string, timeoutMs = 8000): Promise<Locator> {
    const candidates = this.candidatesFor(nameOrSelector);
    const registered = this.registry.has(nameOrSelector);
    const deadline = Date.now() + timeoutMs;
    let lastError = "";

    while (Date.now() < deadline) {
      for (const candidate of candidates) {
        try {
          const locator = page.locator(candidate).first();
          if ((await locator.count()) > 0) {
            this.maybeHeal(nameOrSelector, candidate, candidates[0]!, registered);
            return locator;
          }
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

  async tryResolve(page: Page, nameOrSelector: string, timeoutMs = 2000): Promise<Locator | null> {
    try {
      return await this.resolve(page, nameOrSelector, timeoutMs);
    } catch {
      return null;
    }
  }

  private maybeHeal(name: string, used: string, primary: string, registered: boolean): void {
    if (!this.onHeal) return;
    // An explicit raw selector the author wrote is not "healing".
    if (!registered && looksLikeSelector(name)) return;
    // Drift among a named selector's candidates, or a guess from a label.
    if (used !== primary || !registered) {
      this.onHeal({ name, used, primary, registered });
    }
  }
}

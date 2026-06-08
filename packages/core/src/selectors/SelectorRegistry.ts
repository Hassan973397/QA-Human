import type { SelectorHint } from "../knowledge/types.js";
import { defaultSelectors } from "./defaultSelectors.js";

/**
 * Central store of named selectors -> ordered candidate list. Seeded from
 * defaults, then config, then discovery hints. Higher-priority sources are
 * inserted first so their candidates are tried earliest.
 */
export class SelectorRegistry {
  private readonly map = new Map<string, string[]>();

  constructor(hints: SelectorHint[] = []) {
    // Config/discovery hints take priority; built-in defaults are appended as a
    // fallback so a user-provided selector is always tried before the generic one.
    for (const hint of hints) this.add(hint.name, hint.candidates);
    for (const [name, candidates] of Object.entries(defaultSelectors)) {
      this.add(name, candidates);
    }
  }

  add(name: string, candidates: string[]): void {
    const existing = this.map.get(name) ?? [];
    const merged = [...existing];
    for (const c of candidates) if (!merged.includes(c)) merged.push(c);
    this.map.set(name, merged);
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  candidates(name: string): string[] | undefined {
    return this.map.get(name);
  }

  names(): string[] {
    return Array.from(this.map.keys());
  }
}

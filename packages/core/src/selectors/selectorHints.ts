/**
 * Heuristics to build candidate selectors from a free-form label or key, used
 * as a last resort when no named selector or explicit locator is provided.
 */
export function hintsForLabel(label: string): string[] {
  const safe = label.replace(/"/g, '\\"');
  return [
    `[data-testid="${safe}"]`,
    `[aria-label="${safe}"]`,
    `[name="${safe}"]`,
    `[placeholder="${safe}"]`,
    `text=${label}`,
  ];
}

/** Whether a string looks like a raw CSS/Playwright selector rather than a name. */
export function looksLikeSelector(value: string): boolean {
  return /[#.[\]>:]|^text=|^xpath=|has-text|data-testid/.test(value);
}

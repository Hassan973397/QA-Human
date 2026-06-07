import type { Locator } from "playwright";

/**
 * Low-level human-like interaction helpers shared by HumanAgent. Kept separate
 * so action behavior (timing, scrolling into view) is easy to tune in one place.
 */
export async function humanClick(locator: Locator, timeoutMs: number): Promise<void> {
  await locator.scrollIntoViewIfNeeded({ timeout: timeoutMs }).catch(() => undefined);
  await locator.click({ timeout: timeoutMs });
}

export async function humanFill(locator: Locator, value: string, timeoutMs: number): Promise<void> {
  await locator.scrollIntoViewIfNeeded({ timeout: timeoutMs }).catch(() => undefined);
  await locator.fill(value, { timeout: timeoutMs });
}

/** Types character-by-character with small delays to mimic a real typist. */
export async function humanType(locator: Locator, value: string, timeoutMs: number): Promise<void> {
  await locator.scrollIntoViewIfNeeded({ timeout: timeoutMs }).catch(() => undefined);
  await locator.click({ timeout: timeoutMs });
  await locator.fill("", { timeout: timeoutMs });
  await locator.pressSequentially(value, { delay: 35, timeout: timeoutMs });
}

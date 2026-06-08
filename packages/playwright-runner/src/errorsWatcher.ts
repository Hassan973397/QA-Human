import type { Page } from "playwright";
import { nowIso } from "@hasan-qa-humans/core";
import type { ReporterRef } from "./BrowserRoleContext.js";

/**
 * Attaches console + page error listeners. Only genuine errors are recorded;
 * warnings and info logs are ignored so the report isn't noisy. Writes to the
 * *currently active* reporter via a ref, so a reused page reports into whichever
 * scenario is running now.
 */
export function attachErrorsWatcher(page: Page, ref: ReporterRef): void {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isNoise(text)) return;
    ref.current?.recordConsoleError({ text, url: page.url(), at: nowIso() });
  });

  page.on("pageerror", (error) => {
    ref.current?.recordConsoleError({
      text: `Uncaught: ${error.message}`,
      url: page.url(),
      at: nowIso(),
    });
  });

  page.on("crash", () => {
    ref.current?.recordConsoleError({ text: "Page crashed.", url: page.url(), at: nowIso() });
  });
}

const NOISE_PATTERNS = [
  /favicon/i,
  /Failed to load resource: the server responded with a status of 404/i,
  /DevTools/i,
  /\[HMR\]/,
  /react-devtools/i,
];

function isNoise(text: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(text));
}

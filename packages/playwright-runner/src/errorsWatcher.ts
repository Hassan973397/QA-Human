import type { Page } from "playwright";
import type { ScenarioReporter } from "@hasan-qa-humans/core";
import { nowIso } from "@hasan-qa-humans/core";

/**
 * Attaches console + page error listeners. Only genuine errors are recorded;
 * warnings and info logs are ignored so the report isn't noisy.
 */
export function attachErrorsWatcher(page: Page, reporter: ScenarioReporter): void {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isNoise(text)) return;
    reporter.recordConsoleError({ text, url: page.url(), at: nowIso() });
  });

  page.on("pageerror", (error) => {
    reporter.recordConsoleError({
      text: `Uncaught: ${error.message}`,
      url: page.url(),
      at: nowIso(),
    });
  });

  page.on("crash", () => {
    reporter.recordConsoleError({ text: "Page crashed.", url: page.url(), at: nowIso() });
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

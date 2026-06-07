import type { Page } from "playwright";
import type { ScenarioReporter } from "@hasan-qa-humans/core";
import { nowIso } from "@hasan-qa-humans/core";

/**
 * Records server errors (HTTP >= 500) and outright request failures. Client
 * errors (4xx) are intentionally not treated as failures here — a 403/404 is
 * often the *expected* result in permission/isolation scenarios.
 */
export function attachNetworkWatcher(page: Page, reporter: ScenarioReporter): void {
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 500) {
      const req = response.request();
      reporter.recordNetworkError({
        url: response.url(),
        status,
        method: req.method(),
        at: nowIso(),
      });
    }
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    // Aborted requests (e.g. navigation cancels) are not real failures.
    if (failure?.errorText === "net::ERR_ABORTED") return;
    reporter.recordNetworkError({
      url: request.url(),
      method: request.method(),
      failure: failure?.errorText ?? "request failed",
      at: nowIso(),
    });
  });
}

import type { Page } from "playwright";
import { nowIso } from "@hasan-qa-humans/core";
import type { ReporterRef } from "./BrowserRoleContext.js";

/**
 * Records server errors (HTTP >= 500) and outright request failures. Client
 * errors (4xx) are intentionally not treated as failures here — a 403/404 is
 * often the *expected* result in permission/isolation scenarios. Writes to the
 * currently active reporter via a ref (reused pages report into the live scenario).
 */
export function attachNetworkWatcher(page: Page, ref: ReporterRef): void {
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 500) {
      const req = response.request();
      ref.current?.recordNetworkError({
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
    ref.current?.recordNetworkError({
      url: request.url(),
      method: request.method(),
      failure: failure?.errorText ?? "request failed",
      at: nowIso(),
    });
  });
}

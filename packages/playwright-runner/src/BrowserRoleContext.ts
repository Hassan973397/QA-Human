import type { BrowserContext, Page } from "playwright";

/** Holds the live Playwright surfaces + bookkeeping for a single role. */
export class BrowserRoleContext {
  tracing = false;

  constructor(
    readonly role: string,
    readonly context: BrowserContext,
    readonly page: Page,
    readonly hasStorageState: boolean,
  ) {}
}

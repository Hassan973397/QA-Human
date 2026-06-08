import type { Locator } from "playwright";
import { joinUrl } from "../utils/path.js";
import { logger } from "../utils/logger.js";
import { ScenarioError } from "../errors/ScenarioError.js";
import type { ArtifactRef } from "../reporting/types.js";
import { humanClick, humanFill, humanType } from "./HumanAction.js";
import {
  checkNoBlankScreen,
  checkNoCrashBanner,
  waitForStablePage,
} from "./HumanAssertions.js";
import type { HumanAgentDeps, SelectorInput } from "./types.js";

/**
 * A HumanAgent represents one logged-in (or guest) persona driving the browser.
 * Every action is recorded as a report step, waits properly, runs post-action
 * sanity checks, and captures a screenshot on failure.
 */
export class HumanAgent {
  readonly role: string;
  private readonly deps: HumanAgentDeps;
  private screenshotCounter = 0;

  constructor(deps: HumanAgentDeps) {
    this.deps = deps;
    this.role = deps.role;
    this.deps.reporter.noteRole(deps.role);
  }

  private get timeout(): number {
    return this.deps.config.browser.defaultTimeoutMs;
  }

  /** Wraps a unit of work as a reported step with failure screenshots. */
  private async act<T>(title: string, fn: () => Promise<T>): Promise<T> {
    const { reporter } = this.deps;
    reporter.beginStep(`[${this.role}] ${title}`, this.role);
    logger.debug(`step: [${this.role}] ${title}`);
    try {
      const result = await fn();
      reporter.endStep("passed");
      return result;
    } catch (error) {
      const message = (error as Error).message;
      await this.captureScreenshot(`fail-${this.slug(title)}`).catch(() => undefined);
      reporter.endStep("failed", message);
      throw error instanceof ScenarioError ? error : new ScenarioError(message);
    }
  }

  // ---- navigation -------------------------------------------------------

  async open(routeNameOrPath: SelectorInput): Promise<void> {
    const path = this.resolveRoute(routeNameOrPath);
    const url = joinUrl(this.deps.config.app.baseUrl, path);
    await this.act(`open ${routeNameOrPath} (${url})`, async () => {
      await this.deps.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.deps.config.browser.navigationTimeoutMs,
      });
      await waitForStablePage(this.deps.page);
    });
  }

  async goto(url: string): Promise<void> {
    await this.act(`goto ${url}`, async () => {
      await this.deps.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.deps.config.browser.navigationTimeoutMs,
      });
      await waitForStablePage(this.deps.page);
    });
  }

  // ---- interactions -----------------------------------------------------

  async click(selector: SelectorInput): Promise<void> {
    await this.act(`click ${selector}`, async () => {
      const locator = await this.locate(selector);
      await humanClick(locator, this.timeout);
      await waitForStablePage(this.deps.page, { timeoutMs: 5000 });
    });
  }

  async fill(selector: SelectorInput, value: string): Promise<void> {
    await this.act(`fill ${selector}`, async () => {
      const locator = await this.locate(selector);
      await humanFill(locator, value, this.timeout);
    });
  }

  async fillByLabel(label: string, value: string): Promise<void> {
    await this.act(`fill by label "${label}"`, async () => {
      const locator = this.deps.page.getByLabel(label).first();
      await humanFill(locator, value, this.timeout);
    });
  }

  async selectOption(selector: SelectorInput, value: string): Promise<void> {
    await this.act(`select "${value}" in ${selector}`, async () => {
      const locator = await this.locate(selector);
      await locator.selectOption(value, { timeout: this.timeout });
    });
  }

  async typeLikeHuman(selector: SelectorInput, value: string): Promise<void> {
    await this.act(`type "${value}" in ${selector}`, async () => {
      const locator = await this.locate(selector);
      await humanType(locator, value, this.timeout);
    });
  }

  // ---- assertions -------------------------------------------------------

  async expectText(textOrRegex: string | RegExp): Promise<void> {
    await this.act(`expect text ${textOrRegex}`, async () => {
      const body = this.deps.page.locator("body");
      await body.waitFor({ state: "visible", timeout: this.timeout });
      const content = (await body.innerText().catch(() => "")) || "";
      const matched =
        typeof textOrRegex === "string" ? content.includes(textOrRegex) : textOrRegex.test(content);
      if (!matched) {
        throw new ScenarioError(`Expected to find text ${textOrRegex} but it was not present.`);
      }
    });
  }

  async expectVisible(selector: SelectorInput): Promise<void> {
    await this.act(`expect visible ${selector}`, async () => {
      const locator = await this.locate(selector);
      await locator.waitFor({ state: "visible", timeout: this.timeout });
    });
  }

  async expectUrl(pattern: string | RegExp): Promise<void> {
    await this.act(`expect url ${pattern}`, async () => {
      const current = this.deps.page.url();
      const matched =
        typeof pattern === "string" ? current.includes(pattern) : pattern.test(current);
      if (!matched) {
        throw new ScenarioError(`Expected URL to match ${pattern} but was ${current}.`);
      }
    });
  }

  /** Asserts the current state indicates the action/route was blocked. */
  async expectBlocked(): Promise<void> {
    await this.act("expect blocked", async () => {
      const state = await this.readAccessState();
      if (!state.blocked) {
        throw new ScenarioError(
          `Expected access to be blocked but it appears allowed (url: ${state.url}).`,
        );
      }
      this.deps.reporter.setStepDetail(`Blocked via: ${state.reason}`);
    });
  }

  async expectPermissionDenied(): Promise<void> {
    await this.expectBlocked();
  }

  async assertNoBlankScreen(): Promise<void> {
    await this.act("assert no blank screen", async () => {
      const blank = await checkNoBlankScreen(this.deps.page);
      if (!blank.ok) throw new ScenarioError(blank.reason ?? "Blank screen detected.");
      const crash = await checkNoCrashBanner(this.deps.page);
      if (!crash.ok) throw new ScenarioError(crash.reason ?? "Crash banner detected.");
    });
  }

  async assertNoCriticalConsoleErrors(): Promise<void> {
    await this.act("assert no critical console errors", async () => {
      const errors = this.deps.reporter.result.consoleErrors;
      if (errors.length > 0) {
        throw new ScenarioError(
          `${errors.length} console error(s) detected, e.g.: ${errors[0]!.text}`,
        );
      }
    });
  }

  async assertNoServerErrors(): Promise<void> {
    await this.act("assert no server errors", async () => {
      const server = this.deps.reporter.result.networkErrors.filter(
        (n) => (n.status ?? 0) >= 500,
      );
      if (server.length > 0) {
        const e = server[0]!;
        throw new ScenarioError(`Server error: ${e.method ?? ""} ${e.url} → ${e.status}`);
      }
    });
  }

  /** Returns true if the selector resolves to an element (no failure recorded). */
  async exists(selector: SelectorInput, timeoutMs = 2500): Promise<boolean> {
    const locator = await this.deps.resolver.tryResolve(this.deps.page, selector, timeoutMs);
    return locator !== null;
  }

  /** Clicks the element only if present; returns whether it clicked. Records a step. */
  async clickIfExists(selector: SelectorInput): Promise<boolean> {
    return this.act(`click if exists ${selector}`, async () => {
      const locator = await this.deps.resolver.tryResolve(this.deps.page, selector, 2500);
      if (!locator) {
        this.deps.reporter.setStepDetail("element not present — skipped");
        return false;
      }
      await humanClick(locator, this.timeout);
      await waitForStablePage(this.deps.page, { timeoutMs: 5000 });
      return true;
    });
  }

  // ---- authenticated API (shares this role's cookies/session) ----------

  /**
   * Issues an HTTP request through this role's browser context, so cookies and
   * auth headers from the logged-in session are sent automatically. This is how
   * scenarios verify API-level authorization + tenant isolation as a real user.
   */
  async apiRequest(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    opts: { data?: unknown; headers?: Record<string, string> } = {},
  ): Promise<{ status: number; ok: boolean; body: unknown }> {
    return this.act(`api ${method} ${path}`, async () => {
      const url = joinUrl(this.deps.config.app.baseUrl, path);
      const res = await this.deps.context.request.fetch(url, {
        method,
        headers: opts.headers,
        ...(opts.data === undefined ? {} : { data: opts.data as object }),
        failOnStatusCode: false,
      });
      const status = res.status();
      let body: unknown = null;
      const text = await res.text().catch(() => "");
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      this.deps.reporter.setStepDetail(`→ ${status}`);
      return { status, ok: res.ok(), body };
    });
  }

  apiGet(path: string, headers?: Record<string, string>) {
    return this.apiRequest("GET", path, { headers });
  }

  apiPost(path: string, data?: unknown, headers?: Record<string, string>) {
    return this.apiRequest("POST", path, { data, headers });
  }

  // ---- memory + artifacts ----------------------------------------------

  remember(key: string, value: unknown): void {
    this.deps.memory.remember(key, value);
  }

  recall<T = unknown>(key: string): T | undefined {
    return this.deps.memory.recall<T>(key);
  }

  share(key: string, value: unknown): void {
    this.deps.memory.share(key, value);
  }

  async screenshot(name: string): Promise<void> {
    await this.captureScreenshot(name);
  }

  async captureState(label: string): Promise<void> {
    await this.act(`capture state: ${label}`, async () => {
      await this.captureScreenshot(`state-${this.slug(label)}`);
    });
  }

  async waitForStablePage(): Promise<void> {
    await waitForStablePage(this.deps.page);
  }

  /** No-op in CI; pauses the inspector when running headed with PWDEBUG. */
  async pauseForDebug(): Promise<void> {
    if (process.env.PWDEBUG) await this.deps.page.pause();
  }

  /** Escape hatch for scenarios needing the raw page. */
  get page() {
    return this.deps.page;
  }

  // ---- internals --------------------------------------------------------

  private async locate(selector: SelectorInput): Promise<Locator> {
    return this.deps.resolver.resolve(this.deps.page, selector, this.timeout);
  }

  private resolveRoute(routeNameOrPath: string): string {
    if (routeNameOrPath.startsWith("/") || /^https?:\/\//i.test(routeNameOrPath)) {
      return routeNameOrPath;
    }
    const configured = this.deps.config.routes[routeNameOrPath];
    if (configured) return configured;
    const discovered = this.deps.graph.routes.find((r) => r.name === routeNameOrPath);
    if (discovered) return discovered.path;
    // Fall back to treating it as a path segment.
    return `/${routeNameOrPath}`;
  }

  private async readAccessState(): Promise<{ blocked: boolean; reason: string; url: string }> {
    const page = this.deps.page;
    const url = page.url();
    const loginRoute = this.deps.config.routes.login ?? "/login";
    if (url.includes(loginRoute) || /\/(login|signin|auth)\b/i.test(url)) {
      return { blocked: true, reason: "redirected to login", url };
    }
    const text = (await page.evaluate(() => document.body?.innerText ?? "").catch(() => "")) || "";
    if (/\b(403|forbidden|access denied|not authorized|unauthorized|permission denied|ليس لديك|غير مصرح)\b/i.test(text)) {
      return { blocked: true, reason: "permission denied message", url };
    }
    if (/\b(404|not found|page not found|غير موجود)\b/i.test(text)) {
      return { blocked: true, reason: "404 not found", url };
    }
    return { blocked: false, reason: "content visible", url };
  }

  private async captureScreenshot(name: string): Promise<void> {
    const sid = this.slug(this.deps.reporter.result.id);
    const file = `${sid}-${this.role}-${String(++this.screenshotCounter).padStart(2, "0")}-${this.slug(name)}.png`;
    const abs = `${this.deps.artifacts.screenshotsDir}/${file}`;
    try {
      await this.deps.page.screenshot({ path: abs, fullPage: false });
      const ref: ArtifactRef = {
        type: "screenshot",
        path: this.deps.artifacts.relativize(abs),
        label: name,
      };
      this.deps.reporter.addScreenshot(ref);
    } catch {
      // never let screenshot failure mask the real error
    }
  }

  private slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  }
}

import path from "node:path";
import { chromium, firefox, webkit, type Browser, type BrowserContext } from "playwright";
import { ensureDir, pathExists, type QaConfig } from "@hasan-qa-humans/core";
import { BrowserRoleContext } from "./BrowserRoleContext.js";
import { shouldRecordVideo } from "./videoManager.js";
import type { PlaywrightEngineOptions } from "./types.js";

const ENGINES = { chromium, firefox, webkit };

/**
 * Launches a single browser and mints isolated BrowserContexts (one per role),
 * restoring saved auth state and configuring video/viewport per the config.
 */
export class BrowserSessionManager {
  private browser: Browser | null = null;

  constructor(private readonly opts: PlaywrightEngineOptions) {}

  private get config(): QaConfig {
    return this.opts.config;
  }

  async launch(): Promise<void> {
    if (this.browser) return;
    const engine = ENGINES[this.opts.browserName ?? "chromium"];
    this.browser = await engine.launch({
      headless: this.config.browser.headless,
      slowMo: this.config.browser.slowMo,
    });
    await ensureDir(this.opts.authDir);
    await ensureDir(this.opts.artifacts.videosDir);
  }

  private authFile(role: string): string {
    return path.join(this.opts.authDir, `${role}.json`);
  }

  async createRoleContext(role: string): Promise<BrowserRoleContext> {
    if (!this.browser) throw new Error("BrowserSessionManager.launch() must be called first.");

    const authPath = this.authFile(role);
    const hasStorageState = role !== "guest" && (await pathExists(authPath));

    const context = await this.browser.newContext({
      viewport: this.config.browser.viewport,
      ...(hasStorageState ? { storageState: authPath } : {}),
      ...(shouldRecordVideo(this.config.browser)
        ? { recordVideo: { dir: this.opts.artifacts.videosDir } }
        : {}),
    });
    context.setDefaultTimeout(this.config.browser.defaultTimeoutMs);
    context.setDefaultNavigationTimeout(this.config.browser.navigationTimeoutMs);

    const page = await context.newPage();
    return new BrowserRoleContext(role, context, page, hasStorageState);
  }

  async persistStorageState(context: BrowserContext, role: string): Promise<void> {
    await ensureDir(this.opts.authDir);
    await context.storageState({ path: this.authFile(role) });
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
  }
}

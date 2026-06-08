import path from "node:path";
import {
  type BrowserEngine,
  type RoleContext,
  type ScenarioReporter,
  type ScenarioStatus,
  type ArtifactRef,
  ensureDir,
  pathExists,
  logger,
} from "@hasan-qa-humans/core";
import { BrowserSessionManager } from "./BrowserSessionManager.js";
import { BrowserRoleContext } from "./BrowserRoleContext.js";
import { attachErrorsWatcher } from "./errorsWatcher.js";
import { attachNetworkWatcher } from "./networkWatcher.js";
import { startTrace, stopTrace } from "./traceManager.js";
import { finalizeVideo } from "./videoManager.js";
import { ScreenshotManager } from "./screenshotManager.js";
import type { PlaywrightEngineOptions } from "./types.js";

/**
 * Concrete BrowserEngine on top of Playwright.
 *
 * By default it keeps **one context per role for the whole run** and reuses it
 * across scenarios — so each role logs in once and only one window per role is
 * opened (config.browser.reuseContexts, default true). Per-scenario traces are
 * captured as tracing chunks; videos are flushed per role at shutdown.
 *
 * When reuseContexts is false it falls back to the classic "fresh isolated
 * context per role per scenario" model (independent per-scenario video/trace,
 * but more windows and repeated logins).
 */
export class PlaywrightEngine implements BrowserEngine {
  private readonly sessions: BrowserSessionManager;
  private readonly screenshots: ScreenshotManager;
  private readonly pool = new Map<string, BrowserRoleContext>();
  private active = new Set<string>();
  private readonly reuse: boolean;

  constructor(private readonly opts: PlaywrightEngineOptions) {
    this.sessions = new BrowserSessionManager(opts);
    this.screenshots = new ScreenshotManager(opts.artifacts.screenshotsDir);
    this.reuse = opts.config.browser.reuseContexts !== false;
  }

  async init(): Promise<void> {
    await this.sessions.launch();
    await this.screenshots.ensure();
  }

  async beginScenario(_scenarioId: string): Promise<void> {
    this.active = new Set();
  }

  async acquireContext(role: string, reporter: ScenarioReporter): Promise<RoleContext> {
    let rc = this.pool.get(role);
    if (rc) {
      // سياق مُعاد استخدامه: وجّه المراقبات لتقرير هذا السيناريو وافتح مقطع تتبّع
      rc.reporterRef.current = reporter;
      if (rc.tracing) await rc.context.tracing.startChunk().catch(() => undefined);
    } else {
      rc = await this.sessions.createRoleContext(role);
      rc.reporterRef.current = reporter;
      attachErrorsWatcher(rc.page, rc.reporterRef);
      attachNetworkWatcher(rc.page, rc.reporterRef);
      rc.tracing = await startTrace(rc.context, this.opts.config.browser);
      if (this.reuse && rc.tracing) await rc.context.tracing.startChunk().catch(() => undefined);
      this.pool.set(role, rc);
    }
    this.active.add(role);
    // نُبلّغ الرنر بأن الدور مُصادَق (جلسة محفوظة أو دخول سابق هذا التشغيل) كي لا
    // يُعيد تسجيل الدخول في كل سيناريو عند إعادة استخدام السياق.
    return { role, page: rc.page, context: rc.context, hasStorageState: rc.authenticated };
  }

  async persistStorageState(role: string): Promise<void> {
    const rc = this.pool.get(role);
    if (!rc) return;
    await this.sessions.persistStorageState(rc.context, role);
    rc.authenticated = true; // دخول ناجح — لا تُعد تسجيل الدخول لهذا الدور
  }

  async finishScenario(
    scenarioId: string,
    status: ScenarioStatus,
    reporter: ScenarioReporter,
  ): Promise<void> {
    const failed = status === "failed";
    for (const role of this.active) {
      const rc = this.pool.get(role);
      if (!rc) continue;
      if (failed) rc.sawFailure = true;

      if (this.reuse) {
        await this.saveTraceChunk(rc, scenarioId, failed, reporter);
        // السياق يبقى مفتوحاً ليُعاد استخدامه في السيناريو التالي.
      } else {
        await this.closeContextWithArtifacts(rc, scenarioId, failed, reporter);
        this.pool.delete(role);
      }
    }
    this.active = new Set();
  }

  async shutdown(): Promise<void> {
    // عند إعادة الاستخدام: أغلق سياقات الأدوار الآن واحفظ فيديوهاتها حسب السياسة.
    for (const rc of this.pool.values()) {
      if (rc.tracing) await rc.context.tracing.stop().catch(() => undefined);
      await rc.context.close().catch(() => undefined);
      const keep = this.opts.config.browser.video === "on" || rc.sawFailure;
      if (keep) {
        const video = await finalizeVideo(
          rc.page,
          this.opts.config.browser,
          this.opts.artifacts.videosDir,
          "run",
          rc.role,
          rc.sawFailure,
        );
        if (video) logger.info(`Saved ${rc.role} session video: ${this.relativize(video)}`);
      } else {
        await rc.page.video()?.delete().catch(() => undefined);
      }
    }
    this.pool.clear();
    await this.sessions.close();
  }

  /** يحفظ مقطع تتبّع السيناريو (عند النجاح-دائماً أو الفشل) بلا إغلاق السياق. */
  private async saveTraceChunk(
    rc: BrowserRoleContext,
    scenarioId: string,
    failed: boolean,
    reporter: ScenarioReporter,
  ): Promise<void> {
    if (!rc.tracing) return;
    const keep = this.opts.config.browser.trace === "on" || failed;
    if (!keep) {
      await rc.context.tracing.stopChunk().catch(() => undefined);
      return;
    }
    await ensureDir(this.opts.artifacts.tracesDir);
    const file = path.join(this.opts.artifacts.tracesDir, `${scenarioId}-${rc.role}.zip`);
    await rc.context.tracing.stopChunk({ path: file }).catch(() => undefined);
    if (await pathExists(file)) reporter.addArtifact(this.ref("trace", file, rc.role));
  }

  /** المسار الكلاسيكي: أوقف التتبّع، أغلق السياق (يُفرّغ الفيديو)، وأرفق الأدلة. */
  private async closeContextWithArtifacts(
    rc: BrowserRoleContext,
    scenarioId: string,
    failed: boolean,
    reporter: ScenarioReporter,
  ): Promise<void> {
    const tracePath = await stopTrace(
      rc.context,
      this.opts.config.browser,
      this.opts.artifacts.tracesDir,
      scenarioId,
      rc.role,
      failed,
    );
    if (tracePath) reporter.addArtifact(this.ref("trace", tracePath, rc.role));

    await rc.context.close().catch(() => undefined);

    const videoPath = await finalizeVideo(
      rc.page,
      this.opts.config.browser,
      this.opts.artifacts.videosDir,
      scenarioId,
      rc.role,
      failed,
    );
    if (videoPath) reporter.addArtifact(this.ref("video", videoPath, rc.role));
  }

  private ref(type: ArtifactRef["type"], absPath: string, role: string): ArtifactRef {
    return { type, path: this.relativize(absPath), label: role };
  }

  private relativize(absPath: string): string {
    const root = this.opts.artifacts.reportDir.replace(/\/+$/, "");
    return absPath.startsWith(root) ? absPath.slice(root.length + 1) : absPath;
  }
}

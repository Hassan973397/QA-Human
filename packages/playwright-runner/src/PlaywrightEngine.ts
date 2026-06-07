import {
  type BrowserEngine,
  type RoleContext,
  type ScenarioReporter,
  type ScenarioStatus,
  type ArtifactRef,
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
 * Concrete BrowserEngine on top of Playwright. Creates one isolated context per
 * role per scenario, wires console/network watchers into the reporter, and
 * collects traces + videos according to the configured retention policy.
 */
export class PlaywrightEngine implements BrowserEngine {
  private readonly sessions: BrowserSessionManager;
  private readonly screenshots: ScreenshotManager;
  private current = new Map<string, BrowserRoleContext>();

  constructor(private readonly opts: PlaywrightEngineOptions) {
    this.sessions = new BrowserSessionManager(opts);
    this.screenshots = new ScreenshotManager(opts.artifacts.screenshotsDir);
  }

  async init(): Promise<void> {
    await this.sessions.launch();
    await this.screenshots.ensure();
  }

  async beginScenario(_scenarioId: string): Promise<void> {
    this.current = new Map();
  }

  async acquireContext(role: string, reporter: ScenarioReporter): Promise<RoleContext> {
    const existing = this.current.get(role);
    if (existing) {
      return {
        role,
        page: existing.page,
        context: existing.context,
        hasStorageState: existing.hasStorageState,
      };
    }

    const rc = await this.sessions.createRoleContext(role);
    attachErrorsWatcher(rc.page, reporter);
    attachNetworkWatcher(rc.page, reporter);
    rc.tracing = await startTrace(rc.context, this.opts.config.browser);
    this.current.set(role, rc);

    return { role, page: rc.page, context: rc.context, hasStorageState: rc.hasStorageState };
  }

  async persistStorageState(role: string): Promise<void> {
    const rc = this.current.get(role);
    if (rc) await this.sessions.persistStorageState(rc.context, role);
  }

  async finishScenario(
    scenarioId: string,
    status: ScenarioStatus,
    reporter: ScenarioReporter,
  ): Promise<void> {
    const failed = status === "failed";
    for (const rc of this.current.values()) {
      const tracePath = await stopTrace(
        rc.context,
        this.opts.config.browser,
        this.opts.artifacts.tracesDir,
        scenarioId,
        rc.role,
        failed,
      );
      if (tracePath) {
        reporter.addArtifact(this.ref("trace", tracePath, rc.role));
      }

      // Closing the context flushes the video file to disk.
      await rc.context.close().catch(() => undefined);

      const videoPath = await finalizeVideo(
        rc.page,
        this.opts.config.browser,
        this.opts.artifacts.videosDir,
        scenarioId,
        rc.role,
        failed,
      );
      if (videoPath) {
        reporter.addArtifact(this.ref("video", videoPath, rc.role));
      }
    }
    this.current = new Map();
  }

  async shutdown(): Promise<void> {
    await this.sessions.close();
  }

  private ref(type: ArtifactRef["type"], absPath: string, role: string): ArtifactRef {
    return { type, path: this.relativize(absPath), label: role };
  }

  private relativize(absPath: string): string {
    const root = this.opts.artifacts.reportDir.replace(/\/+$/, "");
    return absPath.startsWith(root) ? absPath.slice(root.length + 1) : absPath;
  }
}

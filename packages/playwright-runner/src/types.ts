import type { QaConfig } from "@hasan-qa-humans/core";

/** Concrete on-disk locations the engine writes artifacts to. */
export interface ArtifactDirs {
  /** Root of the report (artifact paths are stored relative to here). */
  reportDir: string;
  screenshotsDir: string;
  videosDir: string;
  tracesDir: string;
}

export interface PlaywrightEngineOptions {
  config: QaConfig;
  /** Directory where per-role storageState JSON files live (qa/.auth). */
  authDir: string;
  artifacts: ArtifactDirs;
  /** Browser channel/engine. Defaults to chromium. */
  browserName?: "chromium" | "firefox" | "webkit";
}

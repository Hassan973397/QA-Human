import path from "node:path";
import { ensureDir } from "@hasan-qa-humans/core";

/**
 * Owns the screenshots directory. Human agents write screenshots themselves via
 * the ArtifactSink; this just guarantees the directory exists up front.
 */
export class ScreenshotManager {
  constructor(private readonly screenshotsDir: string) {}

  async ensure(): Promise<void> {
    await ensureDir(this.screenshotsDir);
  }

  pathFor(name: string): string {
    return path.join(this.screenshotsDir, name);
  }
}

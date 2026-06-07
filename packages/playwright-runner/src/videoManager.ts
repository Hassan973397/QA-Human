import path from "node:path";
import type { Page } from "playwright";
import type { BrowserConfig } from "@hasan-qa-humans/core";
import { ensureDir, fs } from "@hasan-qa-humans/core";

/** Whether contexts should record video given the policy. */
export function shouldRecordVideo(browser: BrowserConfig): boolean {
  return browser.video !== "off";
}

/**
 * After a context closes, decide whether to keep the recorded video. For
 * "retain-on-failure" we keep it only when the scenario failed; otherwise we
 * remove the temporary recording. Returns the final video path, or null.
 */
export async function finalizeVideo(
  page: Page,
  browser: BrowserConfig,
  videosDir: string,
  scenarioId: string,
  role: string,
  failed: boolean,
): Promise<string | null> {
  const video = page.video();
  if (!video) return null;

  let temp: string;
  try {
    temp = await video.path();
  } catch {
    return null;
  }

  const keep = browser.video === "on" || (browser.video === "retain-on-failure" && failed);
  if (!keep) {
    await video.delete().catch(() => undefined);
    return null;
  }

  await ensureDir(videosDir);
  const dest = path.join(videosDir, `${scenarioId}-${role}.webm`);
  try {
    await fs.move(temp, dest, { overwrite: true });
    return dest;
  } catch {
    return temp;
  }
}

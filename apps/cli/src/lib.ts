import path from "node:path";
import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";
import type { ConfigImporter } from "@hasan-qa-humans/core";
import type { ArtifactDirs } from "@hasan-qa-humans/playwright-runner";

/**
 * A ConfigImporter backed by tsx, so users can author qa.config.ts and
 * *.scenario.ts in TypeScript and have them imported on the fly.
 */
export const tsxImporter: ConfigImporter = async (absolutePath: string) => {
  const href = pathToFileURL(absolutePath).href;
  return tsImport(href, import.meta.url);
};

export function getProjectRoot(opts: { cwd?: string } = {}): string {
  return path.resolve(opts.cwd ?? process.cwd());
}

export function getQaDir(root: string): string {
  return path.join(root, "qa");
}

export function getAuthDir(root: string): string {
  return path.join(getQaDir(root), ".auth");
}

export function getScenariosDir(root: string): string {
  return path.join(getQaDir(root), "scenarios");
}

export interface ReportPaths extends ArtifactDirs {
  latestDir: string;
  jsonFile: string;
  mdFile: string;
  htmlFile: string;
  artifactsDir: string;
}

export function getReportPaths(root: string): ReportPaths {
  const latestDir = path.join(getQaDir(root), "reports", "latest");
  const artifactsDir = path.join(latestDir, "artifacts");
  return {
    latestDir,
    reportDir: latestDir,
    artifactsDir,
    screenshotsDir: path.join(artifactsDir, "screenshots"),
    videosDir: path.join(artifactsDir, "videos"),
    tracesDir: path.join(artifactsDir, "traces"),
    jsonFile: path.join(latestDir, "report.json"),
    mdFile: path.join(latestDir, "report.md"),
    htmlFile: path.join(latestDir, "report.html"),
  };
}

/** ArtifactSink implementation that relativizes paths against the report dir. */
export function makeArtifactSink(reportPaths: ReportPaths) {
  return {
    screenshotsDir: reportPaths.screenshotsDir,
    relativize(absPath: string): string {
      const root = reportPaths.reportDir.replace(/\/+$/, "");
      return absPath.startsWith(root) ? absPath.slice(root.length + 1) : absPath;
    },
  };
}

import path from "node:path";
import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";
import {
  ProjectScanner,
  KnowledgeStore,
  buildKnowledgeGraph,
  logger,
  type ConfigImporter,
  type QaConfig,
  type AppKnowledgeGraph,
} from "@hasan-qa-humans/core";
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

export interface DiscoverOutcome {
  graph: AppKnowledgeGraph;
  fromCache: boolean;
  filesScanned: number;
  durationMs: number;
}

/**
 * Discover the project with a file-signature cache. If the files haven't changed
 * since the last scan, the cached DiscoveryResult is reused so re-runs are
 * effectively instant. Always rebuilds the knowledge graph from current config.
 */
export async function discoverWithCache(
  root: string,
  config: QaConfig,
  opts: { force?: boolean; persist?: boolean } = {},
): Promise<DiscoverOutcome> {
  const scanner = new ProjectScanner({
    ...config.discovery,
    projectRoot: config.discovery.projectRoot || root,
  });
  const store = new KnowledgeStore(getQaDir(root));

  const signature = await scanner.signature();
  const cache = opts.force ? null : await store.loadDiscoveryCache();

  let discovery;
  let fromCache = false;
  if (cache && cache.signature === signature) {
    discovery = cache.discovery;
    fromCache = true;
    logger.debug("discovery cache hit");
  } else {
    discovery = await scanner.scan();
    await store.saveDiscoveryCache(signature, discovery);
  }

  const graph = buildKnowledgeGraph(config, discovery);
  if (opts.persist !== false) await store.saveAll(graph);

  return { graph, fromCache, filesScanned: discovery.filesScanned, durationMs: discovery.durationMs };
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

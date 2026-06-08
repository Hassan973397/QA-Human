import path from "node:path";
import { writeJson, readJson, writeText, pathExists } from "../utils/file.js";
import { renderDiscoveryReport } from "../discovery/DiscoveryReport.js";
import type { DiscoveryResult } from "../discovery/types.js";
import type { AppKnowledgeGraph } from "./types.js";

interface DiscoveryCacheFile {
  signature: string;
  discovery: DiscoveryResult;
}

/**
 * Persists discovery + knowledge artifacts under <qaDir>/.hqa so subsequent
 * commands (generate, run, report) can reuse them without re-scanning.
 */
export class KnowledgeStore {
  readonly dir: string;

  constructor(qaDir: string) {
    this.dir = path.join(qaDir, ".hqa");
  }

  private p(file: string): string {
    return path.join(this.dir, file);
  }

  async saveAll(graph: AppKnowledgeGraph): Promise<string[]> {
    await writeJson(this.p("app-knowledge-graph.json"), graph);
    await writeJson(this.p("app-map.json"), {
      app: graph.app,
      frameworks: graph.frameworks,
      packageManager: graph.packageManager,
      features: graph.features,
      stats: graph.stats,
    });
    await writeJson(this.p("routes.json"), { routes: graph.routes, pages: graph.pages });
    await writeJson(this.p("forms.json"), { forms: graph.forms });
    await writeJson(this.p("api-map.json"), { endpoints: graph.apiEndpoints });
    await writeJson(this.p("roles.json"), { roles: graph.roles, permissions: graph.permissions });
    await writeJson(this.p("workflows.json"), { workflows: graph.workflows });
    await writeJson(this.p("selectors.json"), { selectors: graph.selectors });
    await writeText(this.p("discovery-report.md"), renderDiscoveryReport(graph));

    return [
      this.p("app-knowledge-graph.json"),
      this.p("app-map.json"),
      this.p("routes.json"),
      this.p("forms.json"),
      this.p("api-map.json"),
      this.p("roles.json"),
      this.p("workflows.json"),
      this.p("discovery-report.md"),
    ];
  }

  async loadGraph(): Promise<AppKnowledgeGraph | null> {
    const file = this.p("app-knowledge-graph.json");
    if (!(await pathExists(file))) return null;
    return readJson<AppKnowledgeGraph | null>(file, null);
  }

  async exists(): Promise<boolean> {
    return pathExists(this.p("app-knowledge-graph.json"));
  }

  // ---- discovery cache (skip re-scan when files are unchanged) ----------

  async loadDiscoveryCache(): Promise<DiscoveryCacheFile | null> {
    const file = this.p("discovery-cache.json");
    if (!(await pathExists(file))) return null;
    return readJson<DiscoveryCacheFile | null>(file, null);
  }

  async saveDiscoveryCache(signature: string, discovery: DiscoveryResult): Promise<void> {
    await writeJson(this.p("discovery-cache.json"), { signature, discovery });
  }
}

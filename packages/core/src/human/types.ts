import type { BrowserContext, Page } from "playwright";
import type { QaConfig } from "../config/schema.js";
import type { AppKnowledgeGraph } from "../knowledge/types.js";
import type { ScenarioReporter } from "../reporting/QaReporter.js";
import type { SelectorResolver } from "../selectors/SelectorResolver.js";
import type { HumanMemory } from "./HumanMemory.js";

/** Sink that turns a screenshot/artifact name into concrete file + report paths. */
export interface ArtifactSink {
  /** Absolute directory where screenshots should be written. */
  screenshotsDir: string;
  /** Convert an absolute artifact path into a path relative to the report root. */
  relativize(absPath: string): string;
}

export interface HumanAgentDeps {
  role: string;
  page: Page;
  context: BrowserContext;
  memory: HumanMemory;
  reporter: ScenarioReporter;
  resolver: SelectorResolver;
  graph: AppKnowledgeGraph;
  config: QaConfig;
  artifacts: ArtifactSink;
}

export type SelectorInput = string;

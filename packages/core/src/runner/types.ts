import type { BrowserContext, Page } from "playwright";
import type { QaConfig } from "../config/schema.js";
import type { AppKnowledgeGraph } from "../knowledge/types.js";
import type { ScenarioReporter } from "../reporting/QaReporter.js";
import type { ScenarioStatus, Severity } from "../reporting/types.js";
import type { HumanAgent } from "../human/HumanAgent.js";

/** A per-role browser surface produced by the engine. */
export interface RoleContext {
  role: string;
  page: Page;
  context: BrowserContext;
  /** True if the context was restored from a saved storageState (already authed). */
  hasStorageState: boolean;
}

/**
 * Port implemented by the Playwright runner. Core depends only on this
 * interface, never on Playwright orchestration code, to avoid a dependency
 * cycle between core and the playwright-runner package.
 */
export interface BrowserEngine {
  init(): Promise<void>;
  beginScenario(scenarioId: string): Promise<void>;
  /** Create (or reuse) a role context, attaching console/network watchers to the reporter. */
  acquireContext(role: string, reporter: ScenarioReporter): Promise<RoleContext>;
  /** Persist the current storageState for a role so future runs skip login. */
  persistStorageState(role: string): Promise<void>;
  finishScenario(
    scenarioId: string,
    status: ScenarioStatus,
    reporter: ScenarioReporter,
  ): Promise<void>;
  shutdown(): Promise<void>;
}

/** Accessor handed to scenarios so they can reference humans by role. */
export interface Humans {
  get(role: string): HumanAgent;
  has(role: string): boolean;
  guest(): HumanAgent;
  customer(): HumanAgent;
  merchant(): HumanAgent;
  merchantB(): HumanAgent;
  agent(): HumanAgent;
  employee(): HumanAgent;
  admin(): HumanAgent;
}

export interface ApiResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

export interface ApiClient {
  get(path: string, init?: RequestInit): Promise<ApiResponse>;
  post(path: string, body?: unknown, init?: RequestInit): Promise<ApiResponse>;
  request(method: string, path: string, init?: RequestInit): Promise<ApiResponse>;
}

export interface ScenarioContext {
  humans: Humans;
  graph: AppKnowledgeGraph;
  report: ScenarioReporter;
  config: QaConfig;
  sharedMemory: Map<string, unknown>;
  api: ApiClient;
  /** Abort the scenario as skipped (not a failure). */
  skip(reason: string): never;
  /** Skip unless the role is available. */
  requireRole(role: string): HumanAgent;
  /** Skip unless a route is known (config or discovery). */
  requireRoute(route: string): string;
  /** Skip unless a feature was discovered. */
  requireFeature(feature: string): void;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  roles: string[];
  tags: string[];
  severity: Severity;
  /** Features that must be present in the knowledge graph or the scenario skips. */
  requiresFeatures?: string[];
  run(ctx: ScenarioContext): Promise<void>;
}

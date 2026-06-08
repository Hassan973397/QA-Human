import type { QaConfig } from "../config/schema.js";
import type { AppKnowledgeGraph } from "../knowledge/types.js";
import { QaReporter, type ScenarioReporter } from "../reporting/QaReporter.js";
import type { QaReport, ScenarioStatus } from "../reporting/types.js";
import { SelectorRegistry } from "../selectors/SelectorRegistry.js";
import { SelectorResolver } from "../selectors/SelectorResolver.js";
import { HumanFactory } from "../human/HumanFactory.js";
import type { HumanAgent } from "../human/HumanAgent.js";
import type { ArtifactSink } from "../human/types.js";
import { ScenarioSkip } from "../errors/ScenarioError.js";
import { logger, pc } from "../utils/logger.js";
import { buildScenarioContext } from "./ScenarioContext.js";
import { performLogin } from "./StepRunner.js";
import type { BrowserEngine, ScenarioDefinition } from "./types.js";

export interface QaRunnerOptions {
  config: QaConfig;
  graph: AppKnowledgeGraph;
  engine: BrowserEngine;
  artifacts: ArtifactSink;
  environment: string;
  failFast?: boolean;
  /** Retry failed scenarios up to N times; a later pass marks them flaky. */
  retries?: number;
}

/**
 * The QaRunner is the conductor: it prepares humans (logging them in as needed),
 * runs each scenario, classifies the outcome, and aggregates the final report.
 * It contains all QA logic and talks to the browser only through BrowserEngine.
 */
export class QaRunner {
  private readonly reporter: QaReporter;
  private readonly resolver: SelectorResolver;
  private readonly sharedMemory = new Map<string, unknown>();

  constructor(private readonly opts: QaRunnerOptions) {
    const registry = new SelectorRegistry(opts.graph.selectors);
    this.resolver = new SelectorResolver(registry, (event) => {
      const message = event.registered
        ? `Selector "${event.name}" healed: matched fallback "${event.used}" (primary "${event.primary}" failed). Promote the working selector in qa.config.ts.`
        : `Selector "${event.name}" was guessed at runtime via "${event.used}". Add a stable data-testid or a named selector for reliability.`;
      this.reporter.addRequiredConfig({ kind: "selector", message });
    });
    this.reporter = new QaReporter({
      appName: opts.config.app.name,
      baseUrl: opts.config.app.baseUrl,
      environment: opts.environment,
      unknowns: opts.graph.unknowns,
      discovery: {
        frameworks: opts.graph.frameworks,
        packageManager: opts.graph.packageManager,
        routes: opts.graph.routes.length,
        apiEndpoints: opts.graph.apiEndpoints.length,
        roles: Object.keys(opts.graph.roles),
        features: opts.graph.features,
        unknowns: opts.graph.unknowns,
      },
    });
  }

  async run(scenarios: ScenarioDefinition[]): Promise<QaReport> {
    await this.opts.engine.init();
    try {
      for (const def of scenarios) {
        const result = await this.runScenario(def);
        if (this.opts.failFast && result === "failed") {
          logger.warn("fail-fast enabled — stopping after first failure.");
          break;
        }
      }
    } finally {
      await this.opts.engine.shutdown();
    }
    return this.reporter.build();
  }

  private async runScenario(def: ScenarioDefinition): Promise<ScenarioStatus> {
    // Feature gate -> blocked (a missing prerequisite, not a failure).
    const missingFeature = (def.requiresFeatures ?? []).find(
      (f) => !this.opts.graph.features.includes(f),
    );
    if (missingFeature) {
      const gate = this.reporter.startScenario(this.meta(def));
      const result = gate.finish("blocked", {
        skipReason: `Required feature not detected in discovery: ${missingFeature}`,
      });
      this.reporter.completeScenario(result);
      this.log(def, "blocked");
      return "blocked";
    }

    const maxAttempts = (this.opts.retries ?? 0) + 1;
    let attempt = 0;
    let last!: { reporter: ScenarioReporter; status: ScenarioStatus };

    while (attempt < maxAttempts) {
      attempt++;
      last = await this.attempt(def);
      // Only retry genuine failures.
      if (last.status !== "failed") break;
      if (attempt < maxAttempts) {
        logger.debug(`retrying ${def.id} (attempt ${attempt + 1}/${maxAttempts})`);
      }
    }

    const result = last.reporter.result;
    result.attempts = attempt - 1;
    result.flaky = last.status === "passed" && attempt > 1;
    this.captureSecurityFindings(def, last.reporter, last.status);
    this.reporter.completeScenario(result);
    this.log(def, last.status, result.flaky);
    return last.status;
  }

  /** A single execution attempt with fresh contexts + reporter. */
  private async attempt(
    def: ScenarioDefinition,
  ): Promise<{ reporter: ScenarioReporter; status: ScenarioStatus }> {
    const reporter = this.reporter.startScenario(this.meta(def));
    await this.opts.engine.beginScenario(def.id);
    const factory = new HumanFactory({
      resolver: this.resolver,
      graph: this.opts.graph,
      config: this.opts.config,
      artifacts: this.opts.artifacts,
      sharedMemory: this.sharedMemory,
    });

    let status: ScenarioStatus = "passed";
    let info: { failureReason?: string; skipReason?: string } = {};
    try {
      const humansMap = await this.prepareHumans(def, factory, reporter);
      const ctx = buildScenarioContext({
        humansMap,
        graph: this.opts.graph,
        reporter,
        config: this.opts.config,
        sharedMemory: this.sharedMemory,
      });
      await def.run(ctx);
    } catch (error) {
      if (error instanceof ScenarioSkip) {
        status = "skipped";
        info = { skipReason: error.message };
      } else {
        status = "failed";
        info = { failureReason: (error as Error).message };
      }
    }

    reporter.finish(status, info);
    await this.opts.engine.finishScenario(def.id, status, reporter);
    return { reporter, status };
  }

  private meta(def: ScenarioDefinition) {
    return { id: def.id, title: def.title, severity: def.severity, tags: def.tags };
  }

  /**
   * Acquires + authenticates the roles a scenario needs. Roles without
   * credentials are simply omitted from the map; if the scenario then asks for
   * one, the Humans accessor raises ScenarioSkip with a clear reason.
   */
  private async prepareHumans(
    def: ScenarioDefinition,
    factory: HumanFactory,
    reporter: ScenarioReporter,
  ): Promise<Map<string, HumanAgent>> {
    const humans = new Map<string, HumanAgent>();
    for (const role of def.roles) {
      const roleCtx = await this.opts.engine.acquireContext(role, reporter);
      const human = factory.create(roleCtx, reporter);

      if (role === "guest") {
        humans.set(role, human);
        continue;
      }
      if (roleCtx.hasStorageState) {
        humans.set(role, human);
        continue;
      }
      const login = await performLogin(human, role, this.opts.config);
      if (login.ok) {
        await this.opts.engine.persistStorageState(role);
        humans.set(role, human);
      } else {
        const required = this.opts.config.roles[role]?.required;
        this.reporter.addRequiredConfig({
          kind: "credentials",
          message: `Role "${role}": ${login.reason}`,
        });
        if (required) {
          // A required role that cannot authenticate is a real failure.
          throw new Error(login.reason ?? `Required role "${role}" could not authenticate.`);
        }
        // Otherwise leave it out — scenario will skip if it needs this role.
      }
    }
    return humans;
  }

  private captureSecurityFindings(
    def: ScenarioDefinition,
    reporter: ScenarioReporter,
    status: ScenarioStatus,
  ): void {
    if (status !== "failed") return;
    if (def.tags.includes("multi-tenant")) {
      this.reporter.addSecurityFinding({
        kind: "tenant-isolation",
        severity: "critical",
        scenarioId: def.id,
        message: reporter.result.failureReason ?? "Tenant isolation scenario failed.",
      });
    } else if (def.tags.includes("permissions")) {
      this.reporter.addSecurityFinding({
        kind: "role-permission",
        severity: "high",
        scenarioId: def.id,
        message: reporter.result.failureReason ?? "Permission scenario failed.",
      });
    }
  }

  private log(def: ScenarioDefinition, status: ScenarioStatus, flaky = false): void {
    const tag =
      status === "passed"
        ? pc.green("PASS")
        : status === "failed"
          ? pc.red("FAIL")
          : status === "blocked"
            ? pc.gray("BLOCK")
            : pc.yellow("SKIP");
    logger.raw(`  ${tag} ${def.id} — ${def.title}${flaky ? pc.magenta(" (flaky)") : ""}`);
  }
}

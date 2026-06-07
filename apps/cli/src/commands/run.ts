import path from "node:path";
import {
  loadQaConfig,
  KnowledgeStore,
  ProjectScanner,
  buildKnowledgeGraph,
  QaRunner,
  SafetyGuard,
  loadUserScenarios,
  renderJsonReport,
  renderMarkdownReport,
  renderHtmlReport,
  writeText,
  ensureDir,
  setVerbose,
  logger,
  pc,
  type AppKnowledgeGraph,
  type QaConfig,
  type QaReport,
  type ScenarioDefinition,
} from "@hasan-qa-humans/core";
import { fs } from "@hasan-qa-humans/core";
import { findBuiltins, builtinScenarios } from "@hasan-qa-humans/scenario-library";
import { PlaywrightEngine } from "@hasan-qa-humans/playwright-runner";
import {
  getProjectRoot,
  getQaDir,
  getAuthDir,
  getScenariosDir,
  getReportPaths,
  makeArtifactSink,
  tsxImporter,
} from "../lib.js";

export interface RunOptions {
  cwd?: string;
  headed?: boolean;
  headless?: boolean;
  scenario?: string;
  role?: string;
  slowMo?: string;
  baseUrl?: string;
  report?: string;
  failFast?: boolean;
  video?: boolean; // commander sets false for --no-video
  trace?: boolean; // commander sets false for --no-trace
  allowProduction?: boolean;
  verbose?: boolean;
}

export async function runCommand(options: RunOptions): Promise<void> {
  if (options.verbose) setVerbose(true);
  const root = getProjectRoot(options);
  const { config: loaded } = await loadQaConfig({ root, importer: tsxImporter });
  const config = applyOverrides(loaded, options);

  // Safety gate.
  const guard = new SafetyGuard(config.safety);
  const decision = guard.evaluate(config.app.baseUrl, options.allowProduction);
  for (const w of decision.warnings) logger.warn(w);
  if (!decision.allowed) {
    for (const r of decision.reasons) logger.error(r);
    process.exitCode = 1;
    return;
  }

  // Knowledge graph (discover on demand).
  const graph = await ensureGraph(root, config);

  // Assemble scenarios.
  const scenarios = await assembleScenarios(root, config, options);
  if (scenarios.length === 0) {
    logger.warn("No scenarios matched. Check config.scenarios, qa/scenarios/, and --scenario.");
    return;
  }

  // Report directory layout.
  const reportPaths = getReportPaths(root);
  await fs.remove(reportPaths.latestDir).catch(() => undefined);
  await ensureDir(reportPaths.screenshotsDir);
  await ensureDir(reportPaths.tracesDir);
  await ensureDir(reportPaths.videosDir);

  const engine = new PlaywrightEngine({
    config,
    authDir: getAuthDir(root),
    artifacts: {
      reportDir: reportPaths.reportDir,
      screenshotsDir: reportPaths.screenshotsDir,
      videosDir: reportPaths.videosDir,
      tracesDir: reportPaths.tracesDir,
    },
  });

  logger.raw(pc.bold(`\nRunning ${scenarios.length} scenario(s) against ${config.app.baseUrl}\n`));

  const runner = new QaRunner({
    config,
    graph,
    engine,
    environment: detectEnvironment(config.app.baseUrl),
    artifacts: makeArtifactSink(reportPaths),
    failFast: options.failFast,
  });

  const report = await runner.run(scenarios);

  await writeReports(report, reportPaths, options.report ?? "all");

  // Console summary.
  const s = report.summary;
  logger.raw("");
  logger.raw(
    `${pc.bold("Summary:")} ${pc.green(`${s.passed} passed`)}, ${pc.red(`${s.failed} failed`)}, ` +
      `${pc.yellow(`${s.skipped} skipped`)}, ${pc.gray(`${s.blocked} blocked`)} (of ${s.total})`,
  );
  if (report.securityFindings.length) {
    logger.raw(pc.red(`Security findings: ${report.securityFindings.length}`));
  }
  logger.raw(`Report: ${pc.cyan(path.relative(root, reportPaths.htmlFile))}`);

  if (s.failed > 0) process.exitCode = 1;
}

function applyOverrides(config: QaConfig, options: RunOptions): QaConfig {
  const headless = options.headed ? false : options.headless ? true : config.browser.headless;
  return {
    ...config,
    app: { ...config.app, baseUrl: options.baseUrl ?? config.app.baseUrl },
    browser: {
      ...config.browser,
      headless,
      slowMo: options.slowMo ? Number(options.slowMo) : config.browser.slowMo,
      video: options.video === false ? "off" : config.browser.video,
      trace: options.trace === false ? "off" : config.browser.trace,
    },
  };
}

async function ensureGraph(root: string, config: QaConfig): Promise<AppKnowledgeGraph> {
  const store = new KnowledgeStore(getQaDir(root));
  const existing = await store.loadGraph();
  if (existing) return existing;
  logger.info("No discovery found — running discovery first...");
  const scanner = new ProjectScanner({
    ...config.discovery,
    projectRoot: config.discovery.projectRoot || root,
  });
  const graph = buildKnowledgeGraph(config, await scanner.scan());
  await store.saveAll(graph);
  return graph;
}

async function assembleScenarios(
  root: string,
  config: QaConfig,
  options: RunOptions,
): Promise<ScenarioDefinition[]> {
  // Built-ins selected by config.scenarios, unless an explicit --scenario filter
  // is given (then the full catalog is available to select from).
  const builtin =
    config.scenarios.length > 0 && !options.scenario
      ? findBuiltins(config.scenarios)
      : builtinScenarios;

  // User scenarios from qa/scenarios and a top-level scenarios/ dir.
  const user = [
    ...(await loadUserScenarios(getScenariosDir(root), tsxImporter)),
    ...(await loadUserScenarios(path.join(root, "scenarios"), tsxImporter)),
  ];

  // De-dupe by id, user overrides built-in.
  const byId = new Map<string, ScenarioDefinition>();
  for (const def of [...builtin, ...user]) byId.set(def.id, def);
  let all = Array.from(byId.values());

  if (options.scenario) {
    all = all.filter((s) => s.id.includes(options.scenario!));
  }
  if (options.role) {
    all = all.filter((s) => s.roles.includes(options.role!));
  }
  return all;
}

async function writeReports(
  report: QaReport,
  paths: ReturnType<typeof getReportPaths>,
  format: string,
): Promise<void> {
  const want = (f: string) => format === "all" || format === f;
  if (want("json")) await writeText(paths.jsonFile, renderJsonReport(report));
  if (want("md")) await writeText(paths.mdFile, renderMarkdownReport(report));
  if (want("html")) await writeText(paths.htmlFile, renderHtmlReport(report));
}

function detectEnvironment(baseUrl: string): string {
  const u = baseUrl.toLowerCase();
  if (u.includes("localhost") || u.includes("127.0.0.1")) return "local";
  if (u.includes("staging") || u.includes("stage")) return "staging";
  if (u.includes("test") || u.includes("qa")) return "test";
  return "unknown";
}

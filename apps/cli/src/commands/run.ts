import path from "node:path";
import { spawn } from "node:child_process";
import {
  loadQaConfig,
  KnowledgeStore,
  QaRunner,
  SafetyGuard,
  loadUserScenarios,
  mergeReports,
  renderJsonReport,
  renderMarkdownReport,
  renderHtmlReport,
  RuleBasedAiAnalyzer,
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
import { PlaywrightEngine, type ArtifactDirs } from "@hasan-qa-humans/playwright-runner";
import {
  getProjectRoot,
  getQaDir,
  getAuthDir,
  getScenariosDir,
  getReportPaths,
  makeArtifactSink,
  discoverWithCache,
  tsxImporter,
  type ReportPaths,
} from "../lib.js";

export interface RunOptions {
  cwd?: string;
  headed?: boolean;
  headless?: boolean;
  scenario?: string;
  role?: string;
  slowMo?: string;
  baseUrl?: string;
  browser?: string;
  workers?: string;
  retries?: string;
  report?: string;
  failFast?: boolean;
  video?: boolean;
  trace?: boolean;
  allowProduction?: boolean;
  open?: boolean;
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

  const graph = await ensureGraph(root, config);

  const scenarios = await assembleScenarios(root, config, options);
  if (scenarios.length === 0) {
    logger.warn("No scenarios matched. Check config.scenarios, qa/scenarios/, and --scenario.");
    return;
  }

  const reportPaths = getReportPaths(root);
  await fs.remove(reportPaths.latestDir).catch(() => undefined);
  await ensureDir(reportPaths.screenshotsDir);
  await ensureDir(reportPaths.tracesDir);
  await ensureDir(reportPaths.videosDir);

  const workers = Math.max(1, Math.min(config.workers, scenarios.length));
  logger.raw(
    pc.bold(
      `\nRunning ${scenarios.length} scenario(s) against ${config.app.baseUrl} ` +
        `[${config.browser.engine}${workers > 1 ? `, ${workers} workers` : ""}]\n`,
    ),
  );

  const artifacts: ArtifactDirs = {
    reportDir: reportPaths.reportDir,
    screenshotsDir: reportPaths.screenshotsDir,
    videosDir: reportPaths.videosDir,
    tracesDir: reportPaths.tracesDir,
  };

  const report =
    workers === 1
      ? await runShard(scenarios, config, graph, artifacts, reportPaths, options)
      : await runParallel(scenarios, workers, config, graph, artifacts, reportPaths, options);

  await writeReports(report, reportPaths, options.report ?? "all");
  await saveHistory(root, reportPaths);

  printSummary(root, report, reportPaths);
  if (options.open) openHtml(reportPaths.htmlFile);
  if (report.summary.failed > 0) process.exitCode = 1;
}

async function runShard(
  scenarios: ScenarioDefinition[],
  config: QaConfig,
  graph: AppKnowledgeGraph,
  artifacts: ArtifactDirs,
  reportPaths: ReportPaths,
  options: RunOptions,
): Promise<QaReport> {
  const engine = new PlaywrightEngine({
    config,
    authDir: getAuthDir(getProjectRoot(options)),
    artifacts,
    browserName: config.browser.engine,
  });
  const runner = new QaRunner({
    config,
    graph,
    engine,
    environment: detectEnvironment(config.app.baseUrl),
    artifacts: makeArtifactSink(reportPaths),
    failFast: options.failFast,
    retries: config.retries,
  });
  return runner.run(scenarios);
}

async function runParallel(
  scenarios: ScenarioDefinition[],
  workers: number,
  config: QaConfig,
  graph: AppKnowledgeGraph,
  artifacts: ArtifactDirs,
  reportPaths: ReportPaths,
  options: RunOptions,
): Promise<QaReport> {
  // Round-robin shard so each worker gets a comparable mix.
  const shards: ScenarioDefinition[][] = Array.from({ length: workers }, () => []);
  scenarios.forEach((s, i) => shards[i % workers]!.push(s));
  const reports = await Promise.all(
    shards.filter((s) => s.length > 0).map((shard) =>
      runShard(shard, config, graph, artifacts, reportPaths, options),
    ),
  );
  return mergeReports(reports);
}

function applyOverrides(config: QaConfig, options: RunOptions): QaConfig {
  const headless = options.headed ? false : options.headless ? true : config.browser.headless;
  const engine = (options.browser as QaConfig["browser"]["engine"]) || config.browser.engine;
  return {
    ...config,
    app: { ...config.app, baseUrl: options.baseUrl ?? config.app.baseUrl },
    workers: options.workers ? Math.max(1, Number(options.workers)) : config.workers,
    retries: options.retries ? Math.max(0, Number(options.retries)) : config.retries,
    browser: {
      ...config.browser,
      engine,
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
  return (await discoverWithCache(root, config)).graph;
}

async function assembleScenarios(
  root: string,
  config: QaConfig,
  options: RunOptions,
): Promise<ScenarioDefinition[]> {
  const builtin =
    config.scenarios.length > 0 && !options.scenario
      ? findBuiltins(config.scenarios)
      : builtinScenarios;

  // User scenarios from qa/scenarios, a top-level scenarios/, and config.scenariosDir.
  const dirs = [getScenariosDir(root), path.join(root, "scenarios")];
  if (config.scenariosDir) dirs.push(path.resolve(root, config.scenariosDir));
  const user: ScenarioDefinition[] = [];
  for (const dir of Array.from(new Set(dirs))) {
    user.push(...(await loadUserScenarios(dir, tsxImporter)));
  }

  const byId = new Map<string, ScenarioDefinition>();
  for (const def of [...builtin, ...user]) byId.set(def.id, def);
  let all = Array.from(byId.values());

  if (options.scenario) all = all.filter((s) => s.id.includes(options.scenario!));
  if (options.role) all = all.filter((s) => s.roles.includes(options.role!));
  return all;
}

async function writeReports(report: QaReport, paths: ReportPaths, format: string): Promise<void> {
  const want = (f: string) => format === "all" || format === f;
  if (want("json")) await writeText(paths.jsonFile, renderJsonReport(report));
  if (want("md")) await writeText(paths.mdFile, renderMarkdownReport(report));
  if (want("html")) await writeText(paths.htmlFile, renderHtmlReport(report));
}

/** Keep a timestamped copy of each run for history + comparison. */
async function saveHistory(root: string, paths: ReportPaths): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(getQaDir(root), "reports", stamp);
  await fs.copy(paths.latestDir, dest).catch(() => undefined);
}

function printSummary(root: string, report: QaReport, paths: ReportPaths): void {
  const s = report.summary;
  logger.raw("");
  logger.raw(
    `${pc.bold("Summary:")} ${pc.green(`${s.passed} passed`)}, ${pc.red(`${s.failed} failed`)}, ` +
      `${pc.yellow(`${s.skipped} skipped`)}, ${pc.gray(`${s.blocked} blocked`)} (of ${s.total})`,
  );
  logger.raw(pc.dim(new RuleBasedAiAnalyzer().summarizeReport(report)));
  if (report.securityFindings.length) {
    logger.raw(pc.red(`Security findings: ${report.securityFindings.length}`));
  }
  logger.raw(`Report: ${pc.cyan(path.relative(root, paths.htmlFile))}`);
}

function openHtml(htmlFile: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [htmlFile], { detached: true, stdio: "ignore" }).unref();
  } catch {
    logger.warn(`Could not auto-open the report; open it manually: ${htmlFile}`);
  }
}

function detectEnvironment(baseUrl: string): string {
  const u = baseUrl.toLowerCase();
  if (u.includes("localhost") || u.includes("127.0.0.1")) return "local";
  if (u.includes("staging") || u.includes("stage")) return "staging";
  if (u.includes("test") || u.includes("qa")) return "test";
  return "unknown";
}

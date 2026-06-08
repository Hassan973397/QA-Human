import path from "node:path";
import { spawn } from "node:child_process";
import {
  readJson,
  pathExists,
  formatDuration,
  fs,
  logger,
  pc,
  type QaReport,
} from "@hasan-qa-humans/core";
import { getProjectRoot, getQaDir, getReportPaths } from "../lib.js";

interface ReportOptions {
  cwd?: string;
  open?: boolean;
  compare?: boolean;
}

export async function reportCommand(options: ReportOptions): Promise<void> {
  const root = getProjectRoot(options);
  const paths = getReportPaths(root);

  if (!(await pathExists(paths.jsonFile))) {
    logger.error("No report found. Run `hqa run` first.");
    process.exitCode = 1;
    return;
  }

  const report = await readJson<QaReport | null>(paths.jsonFile, null);
  if (!report) {
    logger.error("Report file is unreadable.");
    process.exitCode = 1;
    return;
  }

  const s = report.summary;
  logger.raw(pc.bold(`\nQA Report — ${report.appName}`));
  logger.raw(pc.dim(`${report.baseUrl} · ${report.environment} · ${formatDuration(report.durationMs)}`));
  logger.raw("");
  logger.raw(
    `  ${pc.green(`${s.passed} passed`)}  ${pc.red(`${s.failed} failed`)}  ` +
      `${pc.yellow(`${s.skipped} skipped`)}  ${pc.gray(`${s.blocked} blocked`)}  (${s.total} total)`,
  );

  logger.raw("");
  for (const sc of report.scenarios) {
    logger.raw(`  ${badge(sc.status)}  ${sc.id} ${pc.dim(`(${formatDuration(sc.durationMs)})`)}`);
    if (sc.failureReason) logger.raw(pc.red(`        ↳ ${sc.failureReason}`));
    if (sc.skipReason) logger.raw(pc.yellow(`        ↳ ${sc.skipReason}`));
  }

  if (report.securityFindings.length) {
    logger.raw("");
    logger.raw(pc.red(pc.bold("Security findings:")));
    for (const f of report.securityFindings) {
      logger.raw(`  [${f.severity}] ${f.kind} (${f.scenarioId}): ${f.message}`);
    }
  }

  if (options.compare) await compareWithPrevious(root, report);

  logger.raw("");
  logger.raw(pc.bold("Files:"));
  for (const file of [paths.jsonFile, paths.mdFile, paths.htmlFile]) {
    if (await pathExists(file)) logger.raw(`  ${pc.cyan(path.relative(root, file))}`);
  }

  if (options.open) {
    openHtml(paths.htmlFile);
  } else {
    logger.raw("");
    logger.info(`Open the HTML report: ${path.relative(root, paths.htmlFile)} (or pass --open)`);
  }
}

function badge(status: string): string {
  return status === "passed"
    ? pc.green("PASS")
    : status === "failed"
      ? pc.red("FAIL")
      : status === "blocked"
        ? pc.gray("BLOCK")
        : pc.yellow("SKIP");
}

/** Compare the current report against the previous timestamped run. */
async function compareWithPrevious(root: string, current: QaReport): Promise<void> {
  const reportsDir = path.join(getQaDir(root), "reports");
  if (!(await pathExists(reportsDir))) return;
  const entries = (await fs.readdir(reportsDir))
    .filter((e) => e !== "latest")
    .sort()
    .reverse();

  // The most recent timestamped copy is this run; the next is the previous run.
  let previous: QaReport | null = null;
  for (const entry of entries) {
    const jsonFile = path.join(reportsDir, entry, "report.json");
    if (!(await pathExists(jsonFile))) continue;
    const candidate = await readJson<QaReport | null>(jsonFile, null);
    if (!candidate) continue;
    if (candidate.startedAt === current.startedAt) continue; // skip the current run's copy
    previous = candidate;
    break;
  }

  logger.raw("");
  logger.raw(pc.bold("Comparison vs previous run:"));
  if (!previous) {
    logger.raw(pc.dim("  No previous run to compare against."));
    return;
  }

  const prevStatus = new Map(previous.scenarios.map((s) => [s.id, s.status]));
  let changes = 0;
  for (const sc of current.scenarios) {
    const before = prevStatus.get(sc.id);
    if (before && before !== sc.status) {
      changes++;
      const arrow = `${before} → ${sc.status}`;
      const color = sc.status === "failed" ? pc.red : sc.status === "passed" ? pc.green : pc.yellow;
      logger.raw(`  ${color(arrow.padEnd(20))} ${sc.id}`);
    }
  }
  const newly = current.scenarios.filter((s) => !prevStatus.has(s.id));
  for (const sc of newly) logger.raw(`  ${pc.cyan("new".padEnd(20))} ${sc.id} (${sc.status})`);
  if (changes === 0 && newly.length === 0) logger.raw(pc.dim("  No status changes."));
}

function openHtml(htmlFile: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [htmlFile], { detached: true, stdio: "ignore" }).unref();
    logger.info(`Opening ${htmlFile}`);
  } catch {
    logger.warn(`Could not auto-open; open manually: ${htmlFile}`);
  }
}

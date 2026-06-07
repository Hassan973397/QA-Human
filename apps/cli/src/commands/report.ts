import path from "node:path";
import {
  readJson,
  pathExists,
  formatDuration,
  logger,
  pc,
  type QaReport,
} from "@hasan-qa-humans/core";
import { getProjectRoot, getReportPaths } from "../lib.js";

interface ReportOptions {
  cwd?: string;
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
    const badge =
      sc.status === "passed"
        ? pc.green("PASS")
        : sc.status === "failed"
          ? pc.red("FAIL")
          : sc.status === "blocked"
            ? pc.gray("BLOCK")
            : pc.yellow("SKIP");
    logger.raw(`  ${badge}  ${sc.id} ${pc.dim(`(${formatDuration(sc.durationMs)})`)}`);
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

  logger.raw("");
  logger.raw(pc.bold("Files:"));
  for (const file of [paths.jsonFile, paths.mdFile, paths.htmlFile]) {
    if (await pathExists(file)) logger.raw(`  ${pc.cyan(path.relative(root, file))}`);
  }
  logger.raw("");
  logger.info(`Open the HTML report: ${path.relative(root, paths.htmlFile)}`);
}

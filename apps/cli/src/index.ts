#!/usr/bin/env node
import { Command } from "commander";
import { logger, QaError } from "@hasan-qa-humans/core";
import { initCommand } from "./commands/init.js";
import { doctorCommand } from "./commands/doctor.js";
import { discoverCommand } from "./commands/discover.js";
import { generateCommand } from "./commands/generate.js";
import { runCommand } from "./commands/run.js";
import { reportCommand } from "./commands/report.js";

const program = new Command();

program
  .name("hqa")
  .description("Hasan QA Humans — a human-like QA engine on top of Playwright")
  .version("1.0.0");

program
  .command("init")
  .description("Scaffold qa.config.ts, .env.qa.example and the qa/ folder")
  .option("--force", "overwrite existing files")
  .action((opts) => guard(() => initCommand(opts)));

program
  .command("doctor")
  .description("Check environment, browsers, config and credentials")
  .action((opts) => guard(() => doctorCommand(opts)));

program
  .command("discover")
  .description("Study the project and build the App Knowledge Graph")
  .option("--force", "ignore the discovery cache and rescan")
  .action((opts) => guard(() => discoverCommand(opts)));

program
  .command("generate")
  .description("Generate starter scenarios from discovery")
  .option("--force", "overwrite existing scenario files")
  .action((opts) => guard(() => generateCommand(opts)));

program
  .command("run")
  .description("Run the human QA scenarios")
  .option("--headed", "run with a visible browser")
  .option("--headless", "force headless (default)")
  .option("--scenario <id>", "only run scenarios whose id contains this value")
  .option("--role <role>", "only run scenarios that use this role")
  .option("--slow-mo <ms>", "slow down actions by N ms")
  .option("--base-url <url>", "override the app base URL")
  .option("--browser <engine>", "chromium | firefox | webkit")
  .option("--workers <n>", "number of parallel workers")
  .option("--retries <n>", "retry failed scenarios N times (flaky detection)")
  .option("--report <format>", "json | md | html | junit | all", "all")
  .option("--ci", "CI mode: headless, write JUnit XML, emit GitHub annotations")
  .option("--fail-fast", "stop after the first failing scenario")
  .option("--no-video", "disable video recording")
  .option("--no-trace", "disable tracing")
  .option("--allow-production", "permit running against a production-like URL")
  .option("--update-snapshots", "record/refresh visual baselines instead of comparing")
  .option("--open", "open the HTML report when finished")
  .option("--verbose", "verbose logging")
  .action((opts) => guard(() => runCommand(opts)));

program
  .command("report")
  .description("Print the latest report summary and file links")
  .option("--open", "open the HTML report in the browser")
  .option("--compare", "compare against the previous run")
  .action((opts) => guard(() => reportCommand(opts)));

program.parseAsync(process.argv).catch((error) => {
  fail(error);
});

async function guard(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    fail(error);
  }
}

function fail(error: unknown): void {
  if (error instanceof QaError) {
    logger.error(`${error.code}: ${error.message}`);
  } else {
    logger.error((error as Error).message);
    if (process.env.HQA_DEBUG) console.error(error);
  }
  process.exitCode = 1;
}

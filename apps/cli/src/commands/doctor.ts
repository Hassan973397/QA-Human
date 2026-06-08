import { chromium, firefox, webkit } from "playwright";
import {
  loadQaConfig,
  pathExists,
  logger,
  pc,
  type QaConfig,
} from "@hasan-qa-humans/core";
import { fs } from "@hasan-qa-humans/core";
import path from "node:path";
import { getProjectRoot, tsxImporter } from "../lib.js";

type Level = "ok" | "warn" | "fail";

interface Check {
  name: string;
  level: Level;
  detail: string;
}

interface DoctorOptions {
  cwd?: string;
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  const root = getProjectRoot(options);
  const checks: Check[] = [];

  // Node version
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "Node.js version",
    level: major >= 18 ? "ok" : "fail",
    detail: `v${process.versions.node}${major >= 18 ? "" : " (need >= 18)"}`,
  });

  // Package manager
  const pm = detectPm(root);
  checks.push({ name: "Package manager", level: "ok", detail: pm });

  // Playwright browsers (report all engines)
  const engines: Array<[string, { executablePath(): string }]> = [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ];
  const installed: string[] = [];
  for (const [name, engine] of engines) {
    try {
      if (await pathExists(engine.executablePath())) installed.push(name);
    } catch {
      /* not installed */
    }
  }
  checks.push({
    name: "Playwright browsers",
    level: installed.length > 0 ? "ok" : "fail",
    detail:
      installed.length > 0
        ? `installed: ${installed.join(", ")}`
        : "none — run `npx playwright install chromium`",
  });

  // .env.qa
  const envPresent = await pathExists(path.join(root, ".env.qa"));
  checks.push({
    name: ".env.qa file",
    level: envPresent ? "ok" : "warn",
    detail: envPresent ? "found" : "missing (copy from .env.qa.example)",
  });

  // Config
  let config: QaConfig | null = null;
  try {
    const loaded = await loadQaConfig({ root, importer: tsxImporter });
    config = loaded.config;
    checks.push({ name: "qa.config", level: "ok", detail: `valid (${loaded.configFile})` });
  } catch (error) {
    checks.push({ name: "qa.config", level: "fail", detail: (error as Error).message });
  }

  // Credentials
  if (config) {
    const withCreds = Object.entries(config.roles).filter(
      ([, r]) => r.email && r.password,
    );
    checks.push({
      name: "Role credentials",
      level: withCreds.length > 0 ? "ok" : "warn",
      detail:
        withCreds.length > 0
          ? `${withCreds.length} role(s) configured: ${withCreds.map(([k]) => k).join(", ")}`
          : "no role credentials set — auth scenarios will skip",
    });

    // baseURL reachability
    const reach = await probe(config.app.baseUrl);
    checks.push({
      name: "Base URL reachable",
      level: reach.ok ? "ok" : "warn",
      detail: `${config.app.baseUrl} — ${reach.detail}`,
    });
  }

  // AI analyzer
  checks.push({
    name: "LLM failure analysis",
    level: process.env.ANTHROPIC_API_KEY ? "ok" : "warn",
    detail: process.env.ANTHROPIC_API_KEY
      ? "ANTHROPIC_API_KEY set — LLM enrichment enabled"
      : "no ANTHROPIC_API_KEY — using rule-based analyzer",
  });

  render(checks);

  if (checks.some((c) => c.level === "fail")) {
    process.exitCode = 1;
  }
}

function detectPm(root: string): string {
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(root, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(root, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(root, "package-lock.json"))) return "npm";
  return "unknown";
}

async function probe(baseUrl: string): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(baseUrl, { signal: controller.signal });
    return { ok: res.status < 500, detail: `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, detail: `not reachable (${(error as Error).name})` };
  } finally {
    clearTimeout(timer);
  }
}

function render(checks: Check[]): void {
  logger.raw(pc.bold("\nHasan QA Humans — doctor\n"));
  for (const c of checks) {
    const badge =
      c.level === "ok" ? pc.green("PASS") : c.level === "warn" ? pc.yellow("WARN") : pc.red("FAIL");
    logger.raw(`  ${badge}  ${c.name.padEnd(22)} ${pc.dim(c.detail)}`);
  }
  logger.raw("");
}

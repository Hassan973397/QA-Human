import path from "node:path";
import fg from "fast-glob";
import { toPosix } from "../utils/path.js";
import { ScenarioError } from "../errors/ScenarioError.js";
import type { ConfigImporter } from "../config/loadQaConfig.js";
import type { ScenarioDefinition } from "./types.js";

/**
 * Loads user-authored scenario files (*.scenario.ts / *.scenario.js) from a
 * directory, returning their default-exported ScenarioDefinitions.
 */
export async function loadUserScenarios(
  dir: string,
  importer: ConfigImporter,
): Promise<ScenarioDefinition[]> {
  const matches = await fg(["**/*.scenario.{ts,js,mjs,cjs}"], {
    cwd: dir,
    absolute: true,
    onlyFiles: true,
    suppressErrors: true,
  });

  const out: ScenarioDefinition[] = [];
  for (const file of matches.sort()) {
    let mod: unknown;
    try {
      mod = await importer(file);
    } catch (error) {
      throw new ScenarioError(
        `Failed to load scenario ${toPosix(path.relative(dir, file))}: ${(error as Error).message}`,
      );
    }
    const def = extractScenario(mod);
    if (def) out.push(def);
  }
  return out;
}

function extractScenario(mod: unknown): ScenarioDefinition | null {
  if (mod && typeof mod === "object" && "default" in mod) {
    const def = (mod as { default: unknown }).default;
    if (isScenario(def)) return def;
  }
  if (isScenario(mod)) return mod;
  return null;
}

function isScenario(value: unknown): value is ScenarioDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ScenarioDefinition).id === "string" &&
    typeof (value as ScenarioDefinition).run === "function"
  );
}

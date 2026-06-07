import path from "node:path";
import { pathToFileURL } from "node:url";
import { qaConfigSchema, type QaConfig, type QaConfigInput } from "./schema.js";
import { baseConfig } from "./defaults.js";
import { fs } from "../utils/file.js";
import { loadQaEnv } from "../utils/env.js";
import { QaError } from "../errors/QaError.js";

export type ConfigImporter = (absolutePath: string) => Promise<unknown>;

export interface LoadConfigOptions {
  /** Project root to resolve config + env files against. */
  root?: string;
  /** Explicit config file path (relative to root or absolute). */
  configPath?: string;
  /**
   * Importer used to load the config module. Defaults to native dynamic import,
   * which only handles .js/.mjs. The CLI injects a tsx-based importer for .ts.
   */
  importer?: ConfigImporter;
  /** Whether to load .env.qa / .env before reading config. Defaults to true. */
  loadEnv?: boolean;
}

export interface LoadedConfig {
  config: QaConfig;
  configFile: string;
  envFilesLoaded: string[];
  root: string;
}

const CONFIG_CANDIDATES = ["qa.config.ts", "qa.config.mjs", "qa.config.js", "qa.config.cjs"];

export function findConfigFile(root: string, explicit?: string): string | null {
  if (explicit) {
    const full = path.isAbsolute(explicit) ? explicit : path.resolve(root, explicit);
    return fs.existsSync(full) ? full : null;
  }
  for (const candidate of CONFIG_CANDIDATES) {
    const full = path.resolve(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

const defaultImporter: ConfigImporter = async (absolutePath) => {
  return import(pathToFileURL(absolutePath).href);
};

export async function loadQaConfig(options: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const root = options.root ?? process.cwd();
  const envFilesLoaded = options.loadEnv === false ? [] : loadQaEnv(root);

  const configFile = findConfigFile(root, options.configPath);
  if (!configFile) {
    throw new QaError(
      `No qa.config.{ts,js,mjs,cjs} found in ${root}. Run "hqa init" first.`,
      "CONFIG_NOT_FOUND",
      { root },
    );
  }

  const importer = options.importer ?? defaultImporter;
  let mod: unknown;
  try {
    mod = await importer(configFile);
  } catch (error) {
    throw new QaError(
      `Failed to import config file ${configFile}: ${(error as Error).message}`,
      "CONFIG_IMPORT_FAILED",
      { configFile },
    );
  }

  const raw = extractDefault(mod);
  const merged = deepMerge(baseConfig, raw);

  const parsed = qaConfigSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new QaError(`Invalid qa.config:\n${issues}`, "CONFIG_INVALID", { configFile });
  }

  return { config: parsed.data, configFile, envFilesLoaded, root };
}

function extractDefault(mod: unknown): QaConfigInput {
  if (mod && typeof mod === "object" && "default" in mod) {
    return (mod as { default: QaConfigInput }).default;
  }
  return mod as QaConfigInput;
}

type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursive merge where `source` overrides `target`; arrays are replaced. */
export function deepMerge<T>(target: T, source: unknown): T {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return (source === undefined ? target : (source as T));
  }
  const out: Plain = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const existing = out[key];
    out[key] = isPlainObject(existing) && isPlainObject(value)
      ? deepMerge(existing, value)
      : value;
  }
  return out as T;
}

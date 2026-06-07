import type { QaConfigInput } from "./schema.js";

/**
 * Identity helper that gives users full type-checking + autocompletion when
 * authoring `qa.config.ts`. It intentionally does not validate at author time;
 * validation happens in `loadQaConfig` so error messages are centralized.
 */
export function defineQaConfig(config: QaConfigInput): QaConfigInput {
  return config;
}

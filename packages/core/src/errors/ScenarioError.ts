import { QaError } from "./QaError.js";

export class ScenarioError extends QaError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SCENARIO_ERROR", details);
  }
}

/**
 * Thrown by a scenario (or ScenarioContext.skip) to signal that the scenario
 * cannot run because a prerequisite is missing. This is NOT a test failure.
 */
export class ScenarioSkip extends QaError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(reason, "SCENARIO_SKIP", details);
  }
}

import type { SafetyConfig } from "../config/schema.js";
import { QaError } from "../errors/QaError.js";

export interface SafetyDecision {
  allowed: boolean;
  reasons: string[];
  warnings: string[];
}

/**
 * Guards against running destructive tests against production. By default the
 * tool refuses to run when the base URL looks like production and does not match
 * an allowed (local/staging/test) pattern.
 */
export class SafetyGuard {
  constructor(private readonly safety: SafetyConfig) {}

  /** Evaluate whether running against baseUrl is permitted. */
  evaluate(baseUrl: string, allowProduction = false): SafetyDecision {
    const reasons: string[] = [];
    const warnings: string[] = [];
    const url = baseUrl.toLowerCase();

    const looksProd = this.safety.productionUrlPatterns.some((p) => url.includes(p.toLowerCase()));
    const looksAllowed = this.safety.allowedHostPatterns.some((p) =>
      url.includes(p.toLowerCase()),
    );

    if (this.safety.blockProductionBaseUrls && looksProd && !looksAllowed && !allowProduction) {
      reasons.push(
        `Base URL "${baseUrl}" matches a production pattern. Re-run with --allow-production only if this is truly a safe target.`,
      );
    }

    if (looksProd && (looksAllowed || allowProduction)) {
      warnings.push(`Base URL "${baseUrl}" looks production-like — proceed with caution.`);
    }

    if (!looksProd && !looksAllowed) {
      warnings.push(
        `Could not confirm "${baseUrl}" is a local/staging/test environment; destructive actions remain disabled.`,
      );
    }

    return { allowed: reasons.length === 0, reasons, warnings };
  }

  /** Whether destructive API/UI actions may be performed. */
  destructiveAllowed(baseUrl: string): boolean {
    if (!this.safety.allowDestructiveActions) return false;
    const url = baseUrl.toLowerCase();
    return this.safety.allowedHostPatterns.some((p) => url.includes(p.toLowerCase()));
  }

  /** Validate that a value to be deleted carries the required test-data prefix. */
  assertDeletable(value: string): void {
    if (!this.safety.allowDeleteOnlyWithPrefix) return;
    if (!value.startsWith(this.safety.testDataPrefix)) {
      throw new QaError(
        `Refusing to delete "${value}": only data prefixed with "${this.safety.testDataPrefix}" may be deleted.`,
        "SAFETY_DELETE_BLOCKED",
      );
    }
  }

  /** Prefix a label so created test data is clearly identifiable. */
  testData(label: string): string {
    return `${this.safety.testDataPrefix}_${label}`;
  }
}

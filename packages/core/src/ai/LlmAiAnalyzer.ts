import type { AppKnowledgeGraph } from "../knowledge/types.js";
import type { QaReport, ScenarioResult } from "../reporting/types.js";
import { RuleBasedAiAnalyzer, type AiAnalyzer, type FailureAnalysis } from "./AiAnalyzer.js";

/** A minimal text-completion provider (e.g. wrapping an LLM API). */
export type LlmProvider = (prompt: string) => Promise<string>;

/**
 * LLM-ready analyzer. It is wired for a provider but never requires one: when no
 * provider is supplied it transparently uses the deterministic rule-based
 * analyzer, so v1 stays fully offline. Drop in a provider to enable LLM output.
 */
export class LlmAiAnalyzer implements AiAnalyzer {
  private readonly rules = new RuleBasedAiAnalyzer();

  constructor(private readonly provider?: LlmProvider) {}

  /** Whether an LLM provider is active. */
  get enabled(): boolean {
    return typeof this.provider === "function";
  }

  analyzeFailure(result: ScenarioResult): FailureAnalysis {
    // Synchronous contract → use rules; LLM enrichment is async via enrich().
    return this.rules.analyzeFailure(result);
  }

  analyzeDiscovery(graph: AppKnowledgeGraph): string[] {
    return this.rules.analyzeDiscovery(graph);
  }

  suggestScenarios(graph: AppKnowledgeGraph): string[] {
    return this.rules.suggestScenarios(graph);
  }

  summarizeReport(report: QaReport): string {
    return this.rules.summarizeReport(report);
  }

  /** Optional async enrichment of a failure using the LLM, if configured. */
  async enrichFailure(result: ScenarioResult): Promise<FailureAnalysis> {
    if (!this.provider) return this.rules.analyzeFailure(result);
    const prompt = [
      "You are a senior QA engineer. Given this failed scenario, return a concise",
      "suspected root cause and a recommended fix.",
      `Title: ${result.title}`,
      `Failure: ${result.failureReason ?? "(none)"}`,
      `Console errors: ${result.consoleErrors.map((e) => e.text).join("; ") || "none"}`,
      `Network errors: ${result.networkErrors.map((e) => `${e.url} ${e.status ?? e.failure}`).join("; ") || "none"}`,
    ].join("\n");
    try {
      const text = await this.provider(prompt);
      const base = this.rules.analyzeFailure(result);
      return { ...base, suspectedRootCause: text.trim() || base.suspectedRootCause };
    } catch {
      return this.rules.analyzeFailure(result);
    }
  }
}

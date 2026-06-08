// Public API surface for @hasan-qa-humans/core

// Config
export { defineQaConfig } from "./config/defineQaConfig.js";
export {
  loadQaConfig,
  findConfigFile,
  deepMerge,
  type LoadConfigOptions,
  type LoadedConfig,
  type ConfigImporter,
} from "./config/loadQaConfig.js";
export * from "./config/schema.js";
export { defaultSelectorHints, defaultRoutes, baseConfig } from "./config/defaults.js";

// Discovery
export { ProjectScanner } from "./discovery/ProjectScanner.js";
export { renderDiscoveryReport } from "./discovery/DiscoveryReport.js";
export * from "./discovery/types.js";

// Knowledge
export { buildKnowledgeGraph } from "./knowledge/AppKnowledgeGraph.js";
export { KnowledgeStore } from "./knowledge/KnowledgeStore.js";
export * from "./knowledge/types.js";

// Selectors
export { SelectorRegistry } from "./selectors/SelectorRegistry.js";
export {
  SelectorResolver,
  type HealingEvent,
  type HealingCallback,
} from "./selectors/SelectorResolver.js";
export { looksLikeSelector, hintsForLabel } from "./selectors/selectorHints.js";

// Human
export { HumanAgent } from "./human/HumanAgent.js";
export { HumanFactory } from "./human/HumanFactory.js";
export { HumanMemory } from "./human/HumanMemory.js";
export { KNOWN_ROLES, isKnownRole, type KnownRole } from "./human/HumanRole.js";
export type { ArtifactSink, HumanAgentDeps } from "./human/types.js";
export {
  checkNoBlankScreen,
  checkNoCrashBanner,
  waitForStablePage,
} from "./human/HumanAssertions.js";

// Runner / scenario engine
export { QaRunner, type QaRunnerOptions } from "./runner/QaRunner.js";
export { scenario, ScenarioRegistry } from "./runner/ScenarioRegistry.js";
export { loadUserScenarios } from "./runner/ScenarioLoader.js";
export { buildScenarioContext, HumansImpl, HttpApiClient } from "./runner/ScenarioContext.js";
export { performLogin } from "./runner/StepRunner.js";
export * from "./runner/types.js";

// Reporting
export { QaReporter, ScenarioReporter, type ScenarioMeta } from "./reporting/QaReporter.js";
export { renderMarkdownReport } from "./reporting/MarkdownReporter.js";
export { renderJsonReport } from "./reporting/JsonReporter.js";
export { renderHtmlReport } from "./reporting/HtmlReporter.js";
export { classifyFailure } from "./reporting/SeverityClassifier.js";
export * from "./reporting/types.js";

// AI analyzer (rule-based v1, LLM-ready)
export {
  RuleBasedAiAnalyzer,
  type AiAnalyzer,
  type FailureAnalysis,
} from "./ai/AiAnalyzer.js";
export { LlmAiAnalyzer, type LlmProvider } from "./ai/LlmAiAnalyzer.js";

// Reporting merge (parallel runs)
export { mergeReports } from "./reporting/QaReporter.js";

// Quality (visual regression + accessibility)
export { compareScreenshots, type VisualDiffResult } from "./quality/visualCompare.js";
export {
  runAxeAudit,
  impactAtLeast,
  type A11yViolationResult,
  type ImpactLevel,
} from "./quality/a11yAudit.js";
export { auditPageHeuristics, type RawUxFinding } from "./quality/uxHeuristics.js";
export { auditUiQuality, checkHorizontalOverflow } from "./quality/uiQuality.js";
export { auditSeo } from "./quality/seoAudit.js";
export { auditApi } from "./quality/apiAudit.js";

// Safety
export { SafetyGuard, type SafetyDecision } from "./safety/SafetyGuard.js";

// Errors
export { QaError } from "./errors/QaError.js";
export { DiscoveryError } from "./errors/DiscoveryError.js";
export { ScenarioError, ScenarioSkip } from "./errors/ScenarioError.js";

// Utils
export { logger, setVerbose, pc } from "./utils/logger.js";
export { formatDuration, nowIso, now, sleep } from "./utils/time.js";
export { joinUrl, toPosix, relativePosix, resolveFrom } from "./utils/path.js";
export {
  ensureDir,
  writeJson,
  readJson,
  writeText,
  readTextSafe,
  pathExists,
  copyIfMissing,
  fs,
} from "./utils/file.js";
export { loadQaEnv, getEnv } from "./utils/env.js";
export { stableStringify, safeParse } from "./utils/safeJson.js";

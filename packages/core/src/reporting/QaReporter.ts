import { now, nowIso } from "../utils/time.js";
import { classifyFailure } from "./SeverityClassifier.js";
import type {
  ArtifactRef,
  ConsoleErrorEntry,
  NetworkErrorEntry,
  QaReport,
  ScenarioResult,
  ScenarioStatus,
  SecurityFinding,
  Severity,
  StepResult,
  StepStatus,
  RequiredConfigItem,
  DiscoverySummary,
  PageMetric,
} from "./types.js";

export interface ScenarioMeta {
  id: string;
  title: string;
  severity: Severity;
  tags: string[];
}

/**
 * Per-scenario recorder handed to human agents. All UI actions, console/network
 * events and artifacts flow through this object so the final report is complete.
 */
export class ScenarioReporter {
  readonly result: ScenarioResult;
  private startTime: number;
  private activeStep: StepResult | null = null;
  private activeStepStart = 0;

  constructor(meta: ScenarioMeta) {
    this.startTime = now();
    this.result = {
      id: meta.id,
      title: meta.title,
      status: "passed",
      severity: meta.severity,
      tags: meta.tags,
      rolesUsed: [],
      durationMs: 0,
      attempts: 0,
      flaky: false,
      steps: [],
      artifacts: [],
      metrics: [],
      consoleErrors: [],
      networkErrors: [],
    };
  }

  noteRole(role: string): void {
    if (!this.result.rolesUsed.includes(role)) this.result.rolesUsed.push(role);
  }

  beginStep(title: string, role?: string): void {
    this.endStep("passed");
    this.activeStep = { title, status: "info", role, durationMs: 0, screenshots: [] };
    this.activeStepStart = now();
  }

  setStepDetail(detail: string): void {
    if (this.activeStep) this.activeStep.detail = detail;
  }

  endStep(status: StepStatus, error?: string): void {
    if (!this.activeStep) return;
    this.activeStep.status = status;
    this.activeStep.durationMs = now() - this.activeStepStart;
    if (error) this.activeStep.error = error;
    this.result.steps.push(this.activeStep);
    this.activeStep = null;
  }

  addScreenshot(ref: ArtifactRef): void {
    this.result.artifacts.push(ref);
    if (this.activeStep) this.activeStep.screenshots.push(ref);
  }

  addArtifact(ref: ArtifactRef): void {
    this.result.artifacts.push(ref);
  }

  recordMetric(metric: PageMetric): void {
    this.result.metrics.push(metric);
  }

  recordConsoleError(entry: ConsoleErrorEntry): void {
    this.result.consoleErrors.push(entry);
  }

  recordNetworkError(entry: NetworkErrorEntry): void {
    this.result.networkErrors.push(entry);
  }

  finish(status: ScenarioStatus, info?: { failureReason?: string; skipReason?: string }): ScenarioResult {
    this.endStep(status === "failed" ? "failed" : "passed");
    this.result.status = status;
    this.result.durationMs = now() - this.startTime;
    if (info?.failureReason) this.result.failureReason = info.failureReason;
    if (info?.skipReason) this.result.skipReason = info.skipReason;
    if (status === "failed") {
      const classified = classifyFailure(this.result);
      this.result.severity = classified.severity;
      this.result.suspectedRootCause = classified.suspectedRootCause;
      this.result.recommendedFix = classified.recommendedFix;
    }
    return this.result;
  }
}

/**
 * Merges several QaReports (one per parallel worker) into a single report.
 * Scenario order follows the input order of `reports`. Summary is recomputed.
 */
export function mergeReports(reports: QaReport[]): QaReport {
  if (reports.length === 0) {
    throw new Error("mergeReports requires at least one report.");
  }
  const base = reports[0]!;
  const scenarios = reports.flatMap((r) => r.scenarios);
  const securityFindings = reports.flatMap((r) => r.securityFindings);
  const requiredConfig = dedupeBy(
    reports.flatMap((r) => r.requiredConfig),
    (i) => i.message,
  );
  const unknowns = Array.from(new Set(reports.flatMap((r) => r.unknowns)));
  const startedAt = reports.map((r) => r.startedAt).sort()[0]!;
  const finishedAt = reports.map((r) => r.finishedAt).sort().reverse()[0]!;

  return {
    appName: base.appName,
    baseUrl: base.baseUrl,
    environment: base.environment,
    startedAt,
    finishedAt,
    durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    discovery: base.discovery,
    summary: {
      total: scenarios.length,
      passed: scenarios.filter((s) => s.status === "passed").length,
      failed: scenarios.filter((s) => s.status === "failed").length,
      skipped: scenarios.filter((s) => s.status === "skipped").length,
      blocked: scenarios.filter((s) => s.status === "blocked").length,
    },
    scenarios,
    securityFindings,
    unknowns,
    requiredConfig,
  };
}

function dedupeBy<T>(arr: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** Aggregates all scenario results into the final QaReport. */
export class QaReporter {
  private readonly scenarios: ScenarioResult[] = [];
  private readonly securityFindings: SecurityFinding[] = [];
  private readonly requiredConfig: RequiredConfigItem[] = [];
  private readonly startedAt = nowIso();
  private readonly startMs = now();

  constructor(
    private readonly meta: {
      appName: string;
      baseUrl: string;
      environment: string;
      discovery?: DiscoverySummary;
      unknowns?: string[];
    },
  ) {}

  startScenario(meta: ScenarioMeta): ScenarioReporter {
    return new ScenarioReporter(meta);
  }

  completeScenario(result: ScenarioResult): void {
    this.scenarios.push(result);
  }

  addSecurityFinding(finding: SecurityFinding): void {
    this.securityFindings.push(finding);
  }

  addRequiredConfig(item: RequiredConfigItem): void {
    if (!this.requiredConfig.some((r) => r.message === item.message)) {
      this.requiredConfig.push(item);
    }
  }

  build(): QaReport {
    const summary = {
      total: this.scenarios.length,
      passed: this.scenarios.filter((s) => s.status === "passed").length,
      failed: this.scenarios.filter((s) => s.status === "failed").length,
      skipped: this.scenarios.filter((s) => s.status === "skipped").length,
      blocked: this.scenarios.filter((s) => s.status === "blocked").length,
    };
    return {
      appName: this.meta.appName,
      baseUrl: this.meta.baseUrl,
      environment: this.meta.environment,
      startedAt: this.startedAt,
      finishedAt: nowIso(),
      durationMs: now() - this.startMs,
      discovery: this.meta.discovery,
      summary,
      scenarios: this.scenarios,
      securityFindings: this.securityFindings,
      unknowns: this.meta.unknowns ?? [],
      requiredConfig: this.requiredConfig,
    };
  }
}

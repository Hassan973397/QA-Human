export type Severity = "critical" | "high" | "medium" | "low";
export type ScenarioStatus = "passed" | "failed" | "skipped" | "blocked";
export type StepStatus = "passed" | "failed" | "info";

export interface ConsoleErrorEntry {
  text: string;
  url?: string;
  at: string;
}

export interface NetworkErrorEntry {
  url: string;
  status?: number;
  method?: string;
  failure?: string;
  at: string;
}

export interface ArtifactRef {
  type: "screenshot" | "video" | "trace";
  path: string;
  label?: string;
}

export interface StepResult {
  title: string;
  status: StepStatus;
  role?: string;
  durationMs: number;
  detail?: string;
  error?: string;
  screenshots: ArtifactRef[];
}

export interface PageMetric {
  url: string;
  role: string;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  overBudget: boolean;
}

export interface VisualCheck {
  name: string;
  status: "match" | "diff" | "new";
  diffRatio: number;
  baselinePath?: string;
  diffPath?: string;
}

export interface A11yViolation {
  scope: string;
  id: string;
  impact: string;
  help: string;
  helpUrl: string;
  nodeCount: number;
}

/**
 * ملاحظة «صاحب المشروع» — تدقيق منتج/تجربة استخدام لكل صفحة:
 * عنصر ناقص (زر/عنوان)، تبويب بمكان خطأ، حقل بلا تسمية، تنقّل مزدحم… إلخ.
 * استشارية بطبيعتها (low/medium) ولا تُفشِل التشغيل — هدفها التحسين لا الإنذار.
 */
export interface UxFinding {
  /** الصفحة التي رُصدت فيها الملاحظة (مسار أو رابط). */
  scope: string;
  /** تصنيف ثابت يُمكّن التجميع، مثل form-maybe-no-submit. */
  category: string;
  severity: Severity;
  /** عنوان قصير بالإنجليزية. */
  title: string;
  /** ما الذي رُصد فعلاً على الصفحة. */
  detail: string;
  /** اقتراح إصلاح بأسلوب صاحب المنتج. */
  suggestion: string;
  /** تلميح لتحديد العنصر في DOM إن وُجد. */
  selector?: string;
}

export interface ScenarioResult {
  id: string;
  title: string;
  status: ScenarioStatus;
  severity: Severity;
  tags: string[];
  rolesUsed: string[];
  durationMs: number;
  /** Number of retry attempts performed (0 = passed/failed on first try). */
  attempts: number;
  /** True when the scenario only passed after a retry. */
  flaky: boolean;
  steps: StepResult[];
  artifacts: ArtifactRef[];
  metrics: PageMetric[];
  visualChecks: VisualCheck[];
  a11yViolations: A11yViolation[];
  /** ملاحظات تدقيق المنتج/التجربة لهذه الصفحات. */
  uxFindings: UxFinding[];
  consoleErrors: ConsoleErrorEntry[];
  networkErrors: NetworkErrorEntry[];
  failureReason?: string;
  skipReason?: string;
  suspectedRootCause?: string;
  recommendedFix?: string;
}

export interface SecurityFinding {
  kind: "role-permission" | "tenant-isolation" | "unauthenticated-access";
  severity: Severity;
  scenarioId: string;
  message: string;
}

export interface RequiredConfigItem {
  kind: "credentials" | "route" | "selector" | "feature";
  message: string;
}

export interface DiscoverySummary {
  frameworks: string[];
  packageManager: string;
  routes: number;
  apiEndpoints: number;
  roles: string[];
  features: string[];
  unknowns: string[];
}

export interface QaReport {
  appName: string;
  baseUrl: string;
  environment: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  discovery?: DiscoverySummary;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    blocked: number;
  };
  scenarios: ScenarioResult[];
  securityFindings: SecurityFinding[];
  unknowns: string[];
  requiredConfig: RequiredConfigItem[];
}

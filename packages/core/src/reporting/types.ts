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

export interface ScenarioResult {
  id: string;
  title: string;
  status: ScenarioStatus;
  severity: Severity;
  tags: string[];
  rolesUsed: string[];
  durationMs: number;
  steps: StepResult[];
  artifacts: ArtifactRef[];
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

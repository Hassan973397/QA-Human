/**
 * The App Knowledge Graph is the single source of truth the human agents and
 * scenarios reason about. Everything in here is *inferred* from the project;
 * anything that could not be inferred lands in `unknowns`.
 */

export type Framework =
  | "next"
  | "react"
  | "vite"
  | "remix"
  | "angular"
  | "vue"
  | "svelte"
  | "express"
  | "nest"
  | "node"
  | "unknown";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun" | "unknown";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "ANY";

export interface RouteNode {
  /** Logical name when known (e.g. "login"), otherwise derived from path. */
  name: string;
  path: string;
  source: string;
  kind: "page" | "api" | "layout" | "unknown";
  /** Roles that appear to guard this route, if any were detected nearby. */
  guards?: string[];
}

export interface FormField {
  name?: string;
  type?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export interface FormNode {
  name: string;
  source: string;
  fields: FormField[];
  submitText?: string;
  purpose?: string;
}

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  source: string;
  authGuarded?: boolean;
  tenantScoped?: boolean;
  resource?: string;
}

export interface RoleCapabilities {
  can: string[];
  cannot: string[];
  detectedFrom: string[];
}

export interface WorkflowStep {
  description: string;
}

export interface WorkflowNode {
  name: string;
  steps: WorkflowStep[];
  confidence: "high" | "medium" | "low";
  detectedFrom: string[];
}

export interface SelectorHint {
  name: string;
  candidates: string[];
  source: "config" | "default" | "discovery";
}

export interface RiskNote {
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  source?: string;
}

export interface AppKnowledgeGraph {
  generatedAt: string;
  app: {
    name: string;
    baseUrl: string;
    type: string;
  };
  frameworks: Framework[];
  packageManager: PackageManager;
  scripts: Record<string, string>;
  routes: RouteNode[];
  pages: RouteNode[];
  forms: FormNode[];
  apiEndpoints: ApiEndpoint[];
  roles: Record<string, RoleCapabilities>;
  permissions: string[];
  workflows: WorkflowNode[];
  selectors: SelectorHint[];
  features: string[];
  risks: RiskNote[];
  unknowns: string[];
  stats: {
    filesScanned: number;
    durationMs: number;
  };
}

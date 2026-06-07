import type {
  ApiEndpoint,
  FormNode,
  Framework,
  PackageManager,
  RoleCapabilities,
  RouteNode,
  SelectorHint,
  WorkflowNode,
} from "../knowledge/types.js";

/** A file read into memory once, shared across every detector. */
export interface ScannedFile {
  /** Absolute path. */
  absPath: string;
  /** Path relative to project root, posix-normalized. */
  relPath: string;
  ext: string;
  content: string;
}

export interface DetectorContext {
  root: string;
  files: ScannedFile[];
  /** Files indexed by relPath for quick lookup. */
  byPath: Map<string, ScannedFile>;
}

export interface FrameworkDetection {
  frameworks: Framework[];
  isMonorepo: boolean;
}

export interface RoleDetection {
  roles: Record<string, RoleCapabilities>;
  permissions: string[];
}

export interface DiscoveryResult {
  frameworks: Framework[];
  isMonorepo: boolean;
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
  unknowns: string[];
  filesScanned: number;
  durationMs: number;
}

import path from "node:path";
import fg from "fast-glob";
import { fs } from "../utils/file.js";
import { toPosix } from "../utils/path.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";
import type { DiscoveryConfig } from "../config/schema.js";
import type { DetectorContext, DiscoveryResult, ScannedFile } from "./types.js";
import { detectFrameworks } from "./FrameworkDetector.js";
import { detectPackageManager } from "./PackageManagerDetector.js";
import { detectRoutes } from "./RouteDetector.js";
import { detectRoles } from "./RoleDetector.js";
import { detectApiEndpoints } from "./ApiDetector.js";
import { detectForms } from "./FormDetector.js";
import { detectComponents } from "./ComponentDetector.js";
import { inferPermissions, hasPermissionEnforcement } from "./PermissionDetector.js";
import { detectWorkflows } from "./WorkflowDetector.js";

const SCANNABLE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".html"]);
const MAX_FILE_BYTES = 400 * 1024;

/**
 * The ProjectScanner reads the target project once, then runs every detector
 * over the shared in-memory file set to produce a DiscoveryResult. It never
 * mutates the target project.
 */
export class ProjectScanner {
  constructor(private readonly discovery: DiscoveryConfig) {}

  async scan(): Promise<DiscoveryResult> {
    const start = now();
    const root = this.discovery.projectRoot;
    const files = await this.readFiles(root);
    const byPath = new Map(files.map((f) => [f.relPath, f]));
    const ctx: DetectorContext = { root, files, byPath };

    logger.debug(`Scanned ${files.length} files for discovery`);

    const { frameworks, isMonorepo } = detectFrameworks(root);
    const { packageManager, scripts } = detectPackageManager(root);
    const routesAll = detectRoutes(ctx);
    const pages = routesAll.filter((r) => r.kind === "page");
    const apiEndpoints = detectApiEndpoints(ctx);
    const forms = detectForms(ctx);
    const selectors = detectComponents(ctx);
    const { roles: rawRoles, permissions } = detectRoles(ctx);
    const roles = inferPermissions(ctx, rawRoles);

    const features = this.inferFeatures({ routesAll, apiEndpoints, forms, hasPerm: hasPermissionEnforcement(ctx), isMonorepo });
    const workflows = detectWorkflows(ctx, { routes: routesAll, apiEndpoints, features });

    const unknowns = this.collectUnknowns({ frameworks, routesAll, roles, forms, apiEndpoints });

    return {
      frameworks,
      isMonorepo,
      packageManager,
      scripts,
      routes: routesAll,
      pages,
      forms,
      apiEndpoints,
      roles,
      permissions,
      workflows,
      selectors,
      features,
      unknowns,
      filesScanned: files.length,
      durationMs: now() - start,
    };
  }

  private async readFiles(root: string): Promise<ScannedFile[]> {
    const entries = await fg(this.discovery.include, {
      cwd: root,
      ignore: this.discovery.exclude,
      absolute: true,
      onlyFiles: true,
      dot: false,
      suppressErrors: true,
    });

    const limited = entries.slice(0, this.discovery.maxFiles);
    const out: ScannedFile[] = [];
    for (const absPath of limited) {
      const ext = path.extname(absPath);
      if (!SCANNABLE_EXT.has(ext)) continue;
      try {
        const stat = await fs.stat(absPath);
        if (stat.size > MAX_FILE_BYTES) continue;
        const content = await fs.readFile(absPath, "utf8");
        out.push({ absPath, relPath: toPosix(path.relative(root, absPath)), ext, content });
      } catch {
        // Unreadable file — skip silently; never break discovery on one file.
      }
    }
    return out;
  }

  private inferFeatures(input: {
    routesAll: { path: string }[];
    apiEndpoints: { path: string }[];
    forms: { purpose?: string }[];
    hasPerm: boolean;
    isMonorepo: boolean;
  }): string[] {
    const features = new Set<string>();
    const haystack = [
      ...input.routesAll.map((r) => r.path),
      ...input.apiEndpoints.map((e) => e.path),
      ...input.forms.map((f) => f.purpose ?? ""),
    ]
      .join(" ")
      .toLowerCase();

    const map: Array<[RegExp, string]> = [
      [/login|auth|signin/, "authentication"],
      [/store|product|catalog|shop/, "catalog"],
      [/cart/, "cart"],
      [/checkout|order/, "ordering"],
      [/customer|client/, "customer-management"],
      [/block|ban|suspend/, "customer-blocking"],
      [/dashboard/, "dashboard"],
      [/admin/, "admin-area"],
      [/tenant|merchant_?id|store_?id|org/, "multi-tenant"],
      [/agent|driver|delivery|courier/, "delivery"],
      [/payment|invoice|billing/, "payments"],
    ];
    for (const [re, feature] of map) {
      if (re.test(haystack)) features.add(feature);
    }
    if (input.hasPerm) features.add("permissions");
    if (input.isMonorepo) features.add("monorepo");
    return Array.from(features).sort();
  }

  private collectUnknowns(input: {
    frameworks: string[];
    routesAll: unknown[];
    roles: Record<string, unknown>;
    forms: unknown[];
    apiEndpoints: unknown[];
  }): string[] {
    const unknowns: string[] = [];
    if (input.frameworks.includes("unknown")) {
      unknowns.push("Frontend/backend framework could not be determined.");
    }
    if (input.routesAll.length === 0) {
      unknowns.push("No routes detected — page smoke tests will rely on configured routes only.");
    }
    if (Object.keys(input.roles).length === 0) {
      unknowns.push("No roles detected — permission and tenant scenarios may be skipped.");
    }
    if (input.forms.length === 0) {
      unknowns.push("No forms detected — login/checkout selectors will rely on defaults.");
    }
    if (input.apiEndpoints.length === 0) {
      unknowns.push("No API endpoints detected — API-level isolation checks may be skipped.");
    }
    return unknowns;
  }
}

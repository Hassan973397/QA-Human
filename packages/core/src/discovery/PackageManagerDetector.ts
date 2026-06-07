import path from "node:path";
import { fs } from "../utils/file.js";
import { safeParse } from "../utils/safeJson.js";
import type { PackageManager } from "../knowledge/types.js";

export interface PackageManagerResult {
  packageManager: PackageManager;
  scripts: Record<string, string>;
}

/**
 * Detects the package manager from lockfiles + packageManager field, and reads
 * the root package.json scripts (dev/build/test/lint/typecheck/start...).
 */
export function detectPackageManager(root: string): PackageManagerResult {
  let packageManager: PackageManager = "unknown";

  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) packageManager = "pnpm";
  else if (fs.existsSync(path.join(root, "yarn.lock"))) packageManager = "yarn";
  else if (fs.existsSync(path.join(root, "bun.lockb"))) packageManager = "bun";
  else if (fs.existsSync(path.join(root, "package-lock.json"))) packageManager = "npm";

  let scripts: Record<string, string> = {};
  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = safeParse<{ scripts?: Record<string, string>; packageManager?: string }>(
      fs.readFileSync(pkgPath, "utf8"),
      {},
    );
    scripts = pkg.scripts ?? {};
    if (packageManager === "unknown" && pkg.packageManager) {
      if (pkg.packageManager.startsWith("pnpm")) packageManager = "pnpm";
      else if (pkg.packageManager.startsWith("yarn")) packageManager = "yarn";
      else if (pkg.packageManager.startsWith("bun")) packageManager = "bun";
      else if (pkg.packageManager.startsWith("npm")) packageManager = "npm";
    }
  }

  return { packageManager, scripts };
}

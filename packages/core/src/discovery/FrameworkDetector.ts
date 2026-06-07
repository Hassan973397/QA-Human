import path from "node:path";
import { fs } from "../utils/file.js";
import { safeParse } from "../utils/safeJson.js";
import type { Framework } from "../knowledge/types.js";
import type { FrameworkDetection } from "./types.js";

interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: unknown;
}

const SIGNATURES: Array<{ dep: string; framework: Framework }> = [
  { dep: "next", framework: "next" },
  { dep: "@remix-run/react", framework: "remix" },
  { dep: "@angular/core", framework: "angular" },
  { dep: "vue", framework: "vue" },
  { dep: "svelte", framework: "svelte" },
  { dep: "vite", framework: "vite" },
  { dep: "react", framework: "react" },
  { dep: "@nestjs/core", framework: "nest" },
  { dep: "express", framework: "express" },
];

/** Detects frameworks from dependency manifests and obvious config files. */
export function detectFrameworks(root: string): FrameworkDetection {
  const found = new Set<Framework>();
  let isMonorepo = false;

  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = safeParse<PkgJson>(fs.readFileSync(pkgPath, "utf8"), {});
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const sig of SIGNATURES) {
      if (allDeps[sig.dep]) found.add(sig.framework);
    }
    if (pkg.workspaces) isMonorepo = true;
  }

  if (fs.existsSync(path.join(root, "pnpm-workspace.yaml"))) isMonorepo = true;
  if (fs.existsSync(path.join(root, "next.config.js")) || fs.existsSync(path.join(root, "next.config.mjs")) || fs.existsSync(path.join(root, "next.config.ts"))) {
    found.add("next");
  }
  if (fs.existsSync(path.join(root, "angular.json"))) found.add("angular");
  if (
    fs.existsSync(path.join(root, "vite.config.ts")) ||
    fs.existsSync(path.join(root, "vite.config.js"))
  ) {
    found.add("vite");
  }

  if (found.size === 0) found.add("unknown");

  // Normalize: if a meta-framework is present, drop the bare "react" noise only
  // when it is purely implied (keep react if it's the only signal).
  const frameworks = Array.from(found);
  return { frameworks, isMonorepo };
}

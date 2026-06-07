import type { ApiEndpoint, HttpMethod } from "../knowledge/types.js";
import type { DetectorContext, ScannedFile } from "./types.js";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const RESOURCE_WORDS = ["order", "customer", "product", "tenant", "user", "merchant", "payment", "cart"];

/**
 * Detects API endpoints from Express/Nest style route declarations, Next.js
 * route handlers, and fetch/axios call sites. Flags auth + tenant scoping.
 */
export function detectApiEndpoints(ctx: DetectorContext): ApiEndpoint[] {
  const endpoints = new Map<string, ApiEndpoint>();
  const add = (e: ApiEndpoint) => {
    const key = `${e.method} ${e.path}`;
    const prev = endpoints.get(key);
    if (!prev) endpoints.set(key, e);
    else {
      prev.authGuarded = prev.authGuarded || e.authGuarded;
      prev.tenantScoped = prev.tenantScoped || e.tenantScoped;
    }
  };

  for (const file of ctx.files) {
    if (!/\.(t|j)sx?$/.test(file.relPath)) continue;
    detectExpressLike(file, add);
    detectNestLike(file, add);
    detectNextHandlers(file, add);
  }

  return Array.from(endpoints.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function authHints(content: string): boolean {
  return /auth|guard|requireAuth|isAuthenticated|jwt|session|bearer|@UseGuards|withAuth|protect/i.test(
    content,
  );
}

function tenantHints(content: string, path: string): boolean {
  return /tenant|merchant_?id|store_?id|org(anization)?_?id|workspace/i.test(content + " " + path);
}

function resourceOf(path: string): string | undefined {
  const lower = path.toLowerCase();
  return RESOURCE_WORDS.find((w) => lower.includes(w));
}

function detectExpressLike(file: ScannedFile, add: (e: ApiEndpoint) => void): void {
  const re = /\b(?:app|router|api)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  let m: RegExpExecArray | null;
  const guarded = authHints(file.content);
  while ((m = re.exec(file.content)) !== null) {
    const method = (m[1] ?? "get").toUpperCase() as HttpMethod;
    const path = m[2] ?? "";
    add({
      method,
      path,
      source: file.relPath,
      authGuarded: guarded,
      tenantScoped: tenantHints(file.content, path),
      resource: resourceOf(path),
    });
  }
}

function detectNestLike(file: ScannedFile, add: (e: ApiEndpoint) => void): void {
  const ctrlMatch = file.content.match(/@Controller\s*\(\s*["'`]?([^"'`)]*)["'`]?\s*\)/);
  if (!ctrlMatch) return;
  const base = "/" + (ctrlMatch[1] ?? "").replace(/^\/+|\/+$/g, "");
  const guarded = authHints(file.content);
  const re = /@(Get|Post|Put|Patch|Delete)\s*\(\s*["'`]?([^"'`)]*)["'`]?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(file.content)) !== null) {
    const method = (m[1] ?? "get").toUpperCase() as HttpMethod;
    const sub = (m[2] ?? "").replace(/^\/+/, "");
    const path = (base === "/" ? "" : base) + (sub ? `/${sub}` : "") || "/";
    add({
      method,
      path,
      source: file.relPath,
      authGuarded: guarded,
      tenantScoped: tenantHints(file.content, path),
      resource: resourceOf(path),
    });
  }
}

function detectNextHandlers(file: ScannedFile, add: (e: ApiEndpoint) => void): void {
  const apiMatch = file.relPath.match(/(?:^|\/)(?:app|pages)\/(.*\/)?api\/(.*)\/route\.(t|j)s$/) ||
    file.relPath.match(/(?:^|\/)pages\/api\/(.*)\.(t|j)s$/);
  if (!apiMatch) return;
  const path = "/" + file.relPath
    .replace(/.*\/api\//, "api/")
    .replace(/\/route\.(t|j)s$/, "")
    .replace(/\.(t|j)s$/, "")
    .replace(/\[(\.\.\.)?([^\]]+)\]/g, ":$2");
  const guarded = authHints(file.content);
  for (const method of METHODS) {
    const re = new RegExp(`export\\s+(?:async\\s+)?(?:function\\s+${method}|const\\s+${method}\\s*=)`);
    if (re.test(file.content)) {
      add({
        method,
        path,
        source: file.relPath,
        authGuarded: guarded,
        tenantScoped: tenantHints(file.content, path),
        resource: resourceOf(path),
      });
    }
  }
}

import type { RouteNode } from "../knowledge/types.js";
import type { DetectorContext, ScannedFile } from "./types.js";

/**
 * Detects pages and routes from:
 *  - Next.js app router (app/.../page.tsx, route.ts)
 *  - Next.js pages router (pages/*.tsx, pages/api/*)
 *  - React Router (<Route path=...>, route config objects)
 *  - explicit path string literals in router-like files
 */
export function detectRoutes(ctx: DetectorContext): RouteNode[] {
  const routes = new Map<string, RouteNode>();
  const add = (node: RouteNode) => {
    const key = `${node.kind}:${node.path}`;
    if (!routes.has(key)) routes.set(key, node);
  };

  for (const file of ctx.files) {
    detectNextRoutes(file, add);
  }
  for (const file of ctx.files) {
    detectReactRouterRoutes(file, add);
  }

  return Array.from(routes.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function detectNextRoutes(file: ScannedFile, add: (n: RouteNode) => void): void {
  const rel = file.relPath;

  // app router
  const appMatch = rel.match(/(?:^|\/)app\/(.*)\/(page|route|layout)\.(t|j)sx?$/);
  if (appMatch) {
    const segments = appMatch[1] ?? "";
    const kindToken = appMatch[2];
    const routePath = "/" + cleanNextSegments(segments);
    const isApi = kindToken === "route" || segments.startsWith("api");
    add({
      name: routeNameFromPath(routePath),
      path: routePath === "/" ? "/" : routePath,
      source: rel,
      kind: kindToken === "layout" ? "layout" : isApi ? "api" : "page",
    });
    return;
  }
  // app router root page
  if (/(?:^|\/)app\/(page|route)\.(t|j)sx?$/.test(rel)) {
    add({ name: "home", path: "/", source: rel, kind: "page" });
    return;
  }

  // pages router
  const pagesMatch = rel.match(/(?:^|\/)pages\/(.*)\.(t|j)sx?$/);
  if (pagesMatch) {
    let p = pagesMatch[1] ?? "";
    if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
    if (p === "index") p = "";
    const routePath = "/" + cleanNextSegments(p);
    const isApi = p.startsWith("api");
    if (/_app|_document|_error/.test(p)) return;
    add({
      name: routeNameFromPath(routePath),
      path: routePath === "/" ? "/" : routePath,
      source: rel,
      kind: isApi ? "api" : "page",
    });
  }
}

function detectReactRouterRoutes(file: ScannedFile, add: (n: RouteNode) => void): void {
  if (!/\.(t|j)sx?$/.test(file.relPath)) return;
  const { content } = file;
  if (!/Route|createBrowserRouter|path\s*:/.test(content)) return;

  // <Route path="/foo" ...>
  const jsxRe = /<Route\s[^>]*path\s*=\s*["'`]([^"'`]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = jsxRe.exec(content)) !== null) {
    const p = normalizePath(m[1] ?? "");
    if (p) add({ name: routeNameFromPath(p), path: p, source: file.relPath, kind: "page" });
  }

  // { path: "/foo", element/component: ... }
  const objRe = /path\s*:\s*["'`]([^"'`]+)["'`]/g;
  while ((m = objRe.exec(content)) !== null) {
    const raw = m[1] ?? "";
    if (!raw.startsWith("/") && raw !== "*") continue;
    const p = normalizePath(raw);
    if (p && p !== "/*") {
      add({ name: routeNameFromPath(p), path: p, source: file.relPath, kind: "page" });
    }
  }
}

function cleanNextSegments(segments: string): string {
  return segments
    .split("/")
    .filter((s) => s && !(s.startsWith("(") && s.endsWith(")"))) // route groups
    .map((s) => s.replace(/^\[\.\.\.(.+)\]$/, ":$1*").replace(/^\[(.+)\]$/, ":$1"))
    .join("/");
}

function normalizePath(p: string): string {
  if (!p.startsWith("/")) return "";
  return p.replace(/\/+$/, "") || "/";
}

function routeNameFromPath(p: string): string {
  const segs = p.split("/").filter(Boolean);
  if (segs.length === 0) return "home";
  return segs[segs.length - 1]!.replace(/[:*]/g, "").replace(/[^a-zA-Z0-9]+/g, "_") || "home";
}

import path from "node:path";

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

export function relativePosix(from: string, to: string): string {
  return toPosix(path.relative(from, to));
}

export function resolveFrom(root: string, p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(root, p);
}

export function joinUrl(baseUrl: string, routePath: string): string {
  if (/^https?:\/\//i.test(routePath)) return routePath;
  const base = baseUrl.replace(/\/+$/, "");
  const route = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${base}${route}`;
}

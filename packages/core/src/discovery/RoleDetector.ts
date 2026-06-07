import type { RoleCapabilities } from "../knowledge/types.js";
import type { DetectorContext } from "./types.js";
import type { RoleDetection } from "./types.js";

const KNOWN_ROLE_WORDS = [
  "admin",
  "superadmin",
  "owner",
  "merchant",
  "vendor",
  "seller",
  "customer",
  "client",
  "buyer",
  "agent",
  "driver",
  "courier",
  "employee",
  "staff",
  "manager",
  "user",
  "guest",
  "support",
];

/**
 * Detects roles + permission strings from enums, constants, guards and
 * role-comparison expressions across the codebase.
 */
export function detectRoles(ctx: DetectorContext): RoleDetection {
  const roleHits = new Map<string, Set<string>>();
  const permissions = new Set<string>();

  const noteRole = (role: string, source: string) => {
    const normalized = role.toLowerCase();
    if (!KNOWN_ROLE_WORDS.includes(normalized)) return;
    const set = roleHits.get(normalized) ?? new Set<string>();
    set.add(source);
    roleHits.set(normalized, set);
  };

  for (const file of ctx.files) {
    if (!/\.(t|j)sx?$/.test(file.relPath)) continue;
    const { content, relPath } = file;

    // role enums: `enum Role { Admin = "admin", ... }` (multi-line body up to "}")
    const enumRe = /\b(?:enum\s+)?(?:Role|UserRole|Roles)\b\s*[{=]([\s\S]{0,600}?)}/g;
    let m: RegExpExecArray | null;
    while ((m = enumRe.exec(content)) !== null) {
      for (const w of extractWords(m[1] ?? "")) noteRole(w, relPath);
    }

    // role string unions / arrays: type Role = 'admin' | 'merchant'
    const unionRe = /\b(?:Role|UserRole|Roles)\b\s*=\s*([^;{}\n]{0,300})/g;
    while ((m = unionRe.exec(content)) !== null) {
      for (const w of extractWords(m[1] ?? "")) noteRole(w, relPath);
    }

    // direct string comparisons: role === 'merchant', role: 'admin'
    const cmpRe = /\brole[A-Za-z]*\s*(?:===|==|:|\)\s*===)\s*["'`]([a-zA-Z_]+)["'`]/g;
    while ((m = cmpRe.exec(content)) !== null) noteRole(m[1] ?? "", relPath);

    // hasRole('x') / requireRole('x') / @Roles('x')
    const callRe = /(?:hasRole|requireRole|isRole|Roles|checkRole)\s*\(?\s*["'`]([a-zA-Z_]+)["'`]/g;
    while ((m = callRe.exec(content)) !== null) noteRole(m[1] ?? "", relPath);

    // permission strings: can('view_orders'), permission: 'order:read', PERMISSIONS.X
    const permRe = /(?:permission|can|ability|policy)\w*\s*[(:=]\s*["'`]([a-zA-Z][a-zA-Z0-9_:.-]+)["'`]/gi;
    while ((m = permRe.exec(content)) !== null) {
      const p = m[1] ?? "";
      if (p.length > 2 && /[_:.-]/.test(p)) permissions.add(p);
    }
  }

  const roles: Record<string, RoleCapabilities> = {};
  for (const [role, sources] of roleHits) {
    roles[role] = { can: [], cannot: [], detectedFrom: Array.from(sources).slice(0, 10) };
  }

  return { roles, permissions: Array.from(permissions).sort() };
}

function extractWords(block: string): string[] {
  const out: string[] = [];
  const re = /["'`]([a-zA-Z_]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out.push(m[1] ?? "");
  // also UPPER_CASE = 'value' style
  const re2 = /\b([A-Z][A-Z_]+)\s*=\s*["'`]?([a-zA-Z_]+)/g;
  while ((m = re2.exec(block)) !== null) out.push(m[2] ?? "");
  return out;
}

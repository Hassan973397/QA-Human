/** Canonical role names the engine understands out of the box. */
export const KNOWN_ROLES = [
  "guest",
  "customer",
  "merchant",
  "merchantB",
  "agent",
  "employee",
  "admin",
] as const;

export type KnownRole = (typeof KNOWN_ROLES)[number];

export function isKnownRole(role: string): role is KnownRole {
  return (KNOWN_ROLES as readonly string[]).includes(role);
}

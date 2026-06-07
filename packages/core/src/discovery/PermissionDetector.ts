import type { RoleCapabilities } from "../knowledge/types.js";
import type { DetectorContext } from "./types.js";

/**
 * Enriches detected roles with inferred can/cannot capabilities based on
 * conventional naming, plus a baseline of common e-commerce expectations.
 * Everything here is a heuristic — scenarios treat these as assumptions to
 * verify, never as ground truth.
 */
export function inferPermissions(
  ctx: DetectorContext,
  roles: Record<string, RoleCapabilities>,
): Record<string, RoleCapabilities> {
  const enriched: Record<string, RoleCapabilities> = {};
  for (const [role, caps] of Object.entries(roles)) {
    enriched[role] = {
      can: dedupe([...caps.can, ...baselineCan(role)]),
      cannot: dedupe([...caps.cannot, ...baselineCannot(role)]),
      detectedFrom: caps.detectedFrom,
    };
  }
  return enriched;
}

function baselineCan(role: string): string[] {
  switch (role) {
    case "customer":
    case "client":
    case "buyer":
      return ["view_store", "add_to_cart", "create_order", "view_own_orders"];
    case "merchant":
    case "vendor":
    case "seller":
      return ["view_orders", "update_order_status", "manage_products", "block_customer"];
    case "agent":
    case "driver":
    case "courier":
      return ["view_assigned_orders", "update_delivery_status"];
    case "admin":
    case "superadmin":
    case "owner":
      return ["view_admin", "manage_users", "manage_tenants"];
    case "employee":
    case "staff":
      return ["view_dashboard"];
    default:
      return [];
  }
}

function baselineCannot(role: string): string[] {
  switch (role) {
    case "customer":
    case "client":
    case "buyer":
      return ["open_merchant_dashboard", "open_admin_dashboard"];
    case "merchant":
    case "vendor":
    case "seller":
      return ["view_other_tenant_orders", "open_admin_dashboard"];
    case "agent":
    case "driver":
    case "courier":
      return ["open_merchant_settings", "open_admin_dashboard"];
    case "employee":
    case "staff":
      return ["open_admin_dashboard"];
    default:
      return [];
  }
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/** Whether the codebase appears to enforce permissions at all. */
export function hasPermissionEnforcement(ctx: DetectorContext): boolean {
  return ctx.files.some((f) =>
    /(?:UseGuards|requireAuth|withAuth|middleware|guard|can\(|ability|casl|rbac|policy)/i.test(
      f.content,
    ),
  );
}

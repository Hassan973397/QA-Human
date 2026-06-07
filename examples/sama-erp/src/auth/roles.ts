// Illustrative role model for the example app (consumed by `hqa discover`).
export enum Role {
  Admin = "admin",
  Merchant = "merchant",
  Agent = "agent",
  Employee = "employee",
  Customer = "customer",
}

export function hasRole(user: { role: string }, role: string): boolean {
  return user.role === role;
}

export const PERMISSIONS = {
  ORDER_READ: "order:read",
  ORDER_UPDATE: "order:update",
  CUSTOMER_BLOCK: "customer:block",
  TENANT_MANAGE: "tenant:manage",
} as const;

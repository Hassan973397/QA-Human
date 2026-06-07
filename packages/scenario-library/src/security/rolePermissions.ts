import { scenario } from "@hasan-qa-humans/core";

interface AccessCheck {
  role: string;
  route: string;
  label: string;
}

/**
 * Verifies that lower-privilege roles cannot reach higher-privilege areas.
 * Each check navigates directly to a protected route and expects to be blocked
 * (redirect to login, 403, 404, or an explicit permission-denied message).
 */
export default scenario({
  id: "security.rolePermissions",
  title: "Role permissions are enforced",
  roles: ["guest", "customer", "merchant", "employee", "admin"],
  tags: ["security", "permissions"],
  severity: "high",
  run: async ({ humans, config, skip }) => {
    const checks: AccessCheck[] = [
      { role: "guest", route: "dashboard", label: "guest → dashboard" },
      { role: "guest", route: "admin", label: "guest → admin" },
      { role: "customer", route: "merchantOrders", label: "customer → merchant orders" },
      { role: "customer", route: "admin", label: "customer → admin" },
      { role: "merchant", route: "admin", label: "merchant → admin" },
      { role: "employee", route: "admin", label: "employee → admin" },
    ];

    const runnable = checks.filter(
      (c) => humans.has(c.role) && Boolean(config.routes[c.route]),
    );
    if (runnable.length === 0) {
      skip("No (role, protected-route) pairs available to verify permissions.");
    }

    for (const check of runnable) {
      const human = humans.get(check.role);
      await human.open(check.route);
      await human.expectBlocked();
    }
  },
});

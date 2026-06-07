import { scenario } from "@hasan-qa-humans/core";

export default scenario({
  id: "sama.security.rolePermissions",
  title: "SAMA: role permissions enforced",
  roles: ["customer", "merchant", "admin"],
  tags: ["security", "permissions"],
  severity: "high",
  run: async ({ humans, config, skip }) => {
    const checks: Array<[string, string]> = [
      ["customer", "merchantOrders"],
      ["customer", "admin"],
      ["merchant", "admin"],
    ];
    const runnable = checks.filter(([role, route]) => humans.has(role) && config.routes[route]);
    if (runnable.length === 0) skip("No (role, route) pairs available.");
    for (const [role, route] of runnable) {
      const human = humans.get(role);
      await human.open(route);
      await human.expectBlocked();
    }
  },
});

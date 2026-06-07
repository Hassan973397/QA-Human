import { scenario } from "@hasan-qa-humans/core";

/**
 * A guest (no session) must not reach authenticated areas. Iterates the most
 * sensitive configured routes and expects each to block the guest.
 */
export default scenario({
  id: "security.unauthenticatedAccess",
  title: "Unauthenticated users cannot access protected areas",
  roles: ["guest"],
  tags: ["security", "permissions"],
  severity: "high",
  run: async ({ humans, config, skip }) => {
    const guest = humans.guest();
    const protectedKeys = ["dashboard", "merchantOrders", "customers", "products", "admin", "orders"];
    const routes = protectedKeys
      .map((k) => config.routes[k])
      .filter((v): v is string => Boolean(v));

    if (routes.length === 0) {
      skip("No protected routes configured to verify unauthenticated access.");
    }

    for (const route of routes) {
      await guest.goto(joinBase(config.app.baseUrl, route));
      await guest.expectBlocked();
    }
  },
});

function joinBase(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return baseUrl.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

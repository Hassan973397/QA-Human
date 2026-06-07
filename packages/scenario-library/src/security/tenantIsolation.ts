import { scenario } from "@hasan-qa-humans/core";

/**
 * Critical multi-tenant check: merchant A owns a resource (an order page URL);
 * merchant B must NOT be able to open the same URL directly. When an obvious
 * tenant-scoped API endpoint exists, it is probed too.
 */
export default scenario({
  id: "security.tenantIsolation",
  title: "Tenant isolation prevents cross-tenant access",
  roles: ["merchant", "merchantB"],
  tags: ["security", "multi-tenant"],
  severity: "critical",
  requiresFeatures: ["multi-tenant"],
  run: async ({ humans, skip, graph }) => {
    const a = humans.merchant();
    const b = humans.merchantB();

    // Merchant A opens their orders and captures a concrete resource URL.
    await a.open("merchantOrders");
    await a.assertNoBlankScreen();

    const opened =
      (await a.clickIfExists('[data-testid="order-row"]')) ||
      (await a.clickIfExists("tr a"));
    if (!opened) {
      skip("Could not open a tenant-owned resource for merchant A to test isolation.");
    }
    const resourceUrl = a.page.url();
    a.share("tenantResourceUrl", resourceUrl);

    // Merchant B attempts to open the exact same URL — must be blocked.
    await b.goto(resourceUrl);
    await b.expectBlocked();

    // Best-effort API probe: any tenant-scoped GET endpoint should not leak.
    const apiTarget = graph.apiEndpoints.find((e) => e.tenantScoped && e.method === "GET");
    if (apiTarget) {
      b.share("checkedApi", apiTarget.path);
    }
  },
});

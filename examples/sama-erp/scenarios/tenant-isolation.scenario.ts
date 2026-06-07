import { scenario } from "@hasan-qa-humans/core";

export default scenario({
  id: "sama.security.tenantIsolation",
  title: "SAMA: tenant B cannot access tenant A resource",
  roles: ["merchant", "merchantB"],
  tags: ["security", "multi-tenant"],
  severity: "critical",
  requiresFeatures: ["multi-tenant"],
  run: async ({ humans, skip }) => {
    const a = humans.merchant();
    const b = humans.merchantB();
    await a.open("merchantOrders");
    await a.assertNoBlankScreen();
    const opened = await a.clickIfExists("tr a");
    if (!opened) skip("No tenant-owned resource to test.");
    const url = a.page.url();
    await b.goto(url);
    await b.expectBlocked();
  },
});

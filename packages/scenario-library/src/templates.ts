export interface ScenarioTemplate {
  /** Output file name within qa/scenarios. */
  file: string;
  /** Discovery feature that makes this template relevant. */
  feature?: string;
  /** Generated TypeScript source. */
  content: string;
}

const header = `import { scenario } from "@hasan-qa-humans/core";\n\n`;

/**
 * Source templates emitted by \`hqa generate\`. They are intentionally simple,
 * defensive starting points that users edit to match their app.
 */
export const scenarioTemplates: ScenarioTemplate[] = [
  {
    file: "smoke-pages.scenario.ts",
    content:
      header +
      `export default scenario({
  id: "custom.smoke.pages",
  title: "Smoke: important pages render",
  roles: ["guest"],
  tags: ["smoke"],
  severity: "high",
  run: async ({ humans, config }) => {
    const guest = humans.guest();
    for (const path of Object.values(config.routes)) {
      await guest.open(path);
      await guest.assertNoBlankScreen();
      await guest.assertNoServerErrors();
    }
  },
});
`,
  },
  {
    file: "auth-login.scenario.ts",
    feature: "authentication",
    content:
      header +
      `export default scenario({
  id: "custom.auth.login",
  title: "Configured roles can log in",
  roles: ["customer", "merchant", "admin"],
  tags: ["auth"],
  severity: "high",
  run: async ({ humans, skip }) => {
    const available = ["customer", "merchant", "admin"].filter((r) => humans.has(r));
    if (available.length === 0) skip("No credentials configured.");
    for (const role of available) {
      await humans.get(role).assertNoBlankScreen();
    }
  },
});
`,
  },
  {
    file: "customer-create-order.scenario.ts",
    feature: "ordering",
    content:
      header +
      `export default scenario({
  id: "custom.ecommerce.customerCreateOrder",
  title: "Customer creates an order",
  roles: ["customer"],
  tags: ["ecommerce", "orders"],
  severity: "critical",
  requiresFeatures: ["ordering"],
  run: async ({ humans }) => {
    const customer = humans.customer();
    await customer.open("store");
    await customer.assertNoBlankScreen();
    const added = await customer.clickIfExists("addToCartButton");
    if (!added) return;
    await customer.clickIfExists("checkoutButton");
    await customer.clickIfExists('button[type="submit"]');
    await customer.assertNoServerErrors();
  },
});
`,
  },
  {
    file: "role-permissions.scenario.ts",
    feature: "permissions",
    content:
      header +
      `export default scenario({
  id: "custom.security.rolePermissions",
  title: "Lower roles cannot reach admin",
  roles: ["customer", "admin"],
  tags: ["security", "permissions"],
  severity: "high",
  run: async ({ humans, config, skip }) => {
    if (!humans.has("customer") || !config.routes.admin) skip("Need customer + admin route.");
    const customer = humans.customer();
    await customer.open("admin");
    await customer.expectBlocked();
  },
});
`,
  },
  {
    file: "tenant-isolation.scenario.ts",
    feature: "multi-tenant",
    content:
      header +
      `export default scenario({
  id: "custom.security.tenantIsolation",
  title: "Tenant B cannot read tenant A's resource",
  roles: ["merchant", "merchantB"],
  tags: ["security", "multi-tenant"],
  severity: "critical",
  requiresFeatures: ["multi-tenant"],
  run: async ({ humans, skip }) => {
    const a = humans.merchant();
    const b = humans.merchantB();
    await a.open("merchantOrders");
    const opened = await a.clickIfExists("tr a");
    if (!opened) skip("No tenant resource to test.");
    const url = a.page.url();
    await b.goto(url);
    await b.expectBlocked();
  },
});
`,
  },
];

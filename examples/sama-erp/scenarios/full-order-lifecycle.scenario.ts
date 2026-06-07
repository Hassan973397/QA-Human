import { scenario } from "@hasan-qa-humans/core";

export default scenario({
  id: "sama.ecommerce.orderLifecycle",
  title: "SAMA: full order lifecycle",
  roles: ["customer", "merchant", "agent"],
  tags: ["ecommerce", "orders"],
  severity: "critical",
  requiresFeatures: ["ordering"],
  run: async ({ humans }) => {
    if (humans.has("customer")) {
      const customer = humans.customer();
      await customer.open("store");
      const added = await customer.clickIfExists("addToCartButton");
      if (added) {
        await customer.clickIfExists("checkoutButton");
        await customer.clickIfExists('button[type="submit"]');
      }
    }
    if (humans.has("merchant")) {
      const merchant = humans.merchant();
      await merchant.open("merchantOrders");
      await merchant.assertNoBlankScreen();
      await merchant.clickIfExists('button:has-text("Accept")');
    }
    if (humans.has("agent")) {
      const agent = humans.agent();
      await agent.open("dashboard");
      await agent.assertNoBlankScreen();
    }
  },
});

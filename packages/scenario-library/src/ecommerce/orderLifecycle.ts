import { scenario } from "@hasan-qa-humans/core";

/**
 * End-to-end order lifecycle across roles. Each phase only runs if the relevant
 * role is available, so it degrades gracefully when (e.g.) no agent exists.
 */
export default scenario({
  id: "ecommerce.orderLifecycle",
  title: "Full order lifecycle (customer → merchant → agent)",
  roles: ["customer", "merchant", "agent"],
  tags: ["ecommerce", "orders"],
  severity: "critical",
  requiresFeatures: ["ordering"],
  run: async ({ humans }) => {
    // Phase 1: customer creates an order (best effort).
    if (humans.has("customer")) {
      const customer = humans.customer();
      await customer.open("store");
      await customer.assertNoBlankScreen();
      const added = await customer.clickIfExists("addToCartButton");
      if (added) {
        await customer.clickIfExists("checkoutButton");
        await customer.clickIfExists('button[type="submit"]');
      }
    }

    // Phase 2: merchant progresses the order status.
    if (humans.has("merchant")) {
      const merchant = humans.merchant();
      await merchant.open("merchantOrders");
      await merchant.assertNoBlankScreen();
      await merchant.assertNoServerErrors();
      await merchant.clickIfExists('button:has-text("Accept")');
    }

    // Phase 3: agent updates delivery status (only if an agent exists).
    if (humans.has("agent")) {
      const agent = humans.agent();
      await agent.open("dashboard");
      await agent.assertNoBlankScreen();
      await agent.clickIfExists('button:has-text("Update status")');
    }
  },
});

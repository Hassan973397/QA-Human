import { scenario } from "@hasan-qa-humans/core";

/**
 * Merchant opens the orders area, inspects an order and (if the workflow exists)
 * changes its status, then verifies the page stays healthy.
 */
export default scenario({
  id: "ecommerce.merchantManageOrder",
  title: "Merchant manages an order",
  roles: ["merchant"],
  tags: ["ecommerce", "orders"],
  severity: "high",
  requiresFeatures: ["ordering"],
  run: async ({ humans }) => {
    const merchant = humans.merchant();

    await merchant.open("merchantOrders");
    await merchant.assertNoBlankScreen();
    await merchant.assertNoServerErrors();

    // Open first order row/link if present.
    const opened =
      (await merchant.clickIfExists('[data-testid="order-row"]')) ||
      (await merchant.clickIfExists('a:has-text("Order")')) ||
      (await merchant.clickIfExists("tr a"));

    if (!opened) return;

    await merchant.assertNoBlankScreen();

    // Try to change status via a select or a status button if the workflow exists.
    const statusChanged =
      (await merchant.clickIfExists('[data-testid="order-status"]')) ||
      (await merchant.clickIfExists('button:has-text("Accept")')) ||
      (await merchant.clickIfExists('button:has-text("قبول")'));

    if (statusChanged) {
      await merchant.assertNoServerErrors();
    }
  },
});

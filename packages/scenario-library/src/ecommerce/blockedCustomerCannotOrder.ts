import { scenario } from "@hasan-qa-humans/core";

/**
 * A blocked customer should not be able to place an order. We attempt the order
 * flow and expect it to be prevented. Skipped if blocking isn't a feature.
 */
export default scenario({
  id: "ecommerce.blockedCustomerCannotOrder",
  title: "Blocked customer cannot create an order",
  roles: ["customer"],
  tags: ["ecommerce", "orders", "permissions"],
  severity: "high",
  requiresFeatures: ["customer-blocking", "ordering"],
  run: async ({ humans, sharedMemory, skip }) => {
    if (!sharedMemory.get("customerBlocked")) {
      skip("Customer was not blocked earlier (run merchantBlockCustomer first).");
    }

    const customer = humans.customer();
    await customer.open("store");
    await customer.assertNoBlankScreen();

    const added = await customer.clickIfExists("addToCartButton");
    if (!added) {
      skip("No add-to-cart control available to test blocked ordering.");
    }

    await customer.clickIfExists("checkoutButton");

    const placed =
      (await customer.clickIfExists('button:has-text("Place order")')) ||
      (await customer.clickIfExists('button:has-text("تأكيد الطلب")'));

    // If we got an order placed without restriction, that's the bug.
    if (placed) {
      await customer.expectBlocked();
    }
  },
});

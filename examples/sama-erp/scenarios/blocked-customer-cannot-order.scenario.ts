import { scenario } from "@hasan-qa-humans/core";

export default scenario({
  id: "sama.customer.blockedCannotOrder",
  title: "SAMA: blocked customer cannot order",
  roles: ["customer"],
  tags: ["ecommerce", "orders", "permissions"],
  severity: "high",
  requiresFeatures: ["customer-blocking", "ordering"],
  run: async ({ humans, sharedMemory, skip }) => {
    if (!sharedMemory.get("customerBlocked")) skip("Customer not blocked yet.");
    const customer = humans.customer();
    await customer.open("store");
    const added = await customer.clickIfExists("addToCartButton");
    if (!added) skip("No add-to-cart control to exercise blocked ordering.");
    await customer.clickIfExists("checkoutButton");
    const placed = await customer.clickIfExists('button[type="submit"]');
    if (placed) await customer.expectBlocked();
  },
});

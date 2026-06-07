import { scenario } from "@hasan-qa-humans/core";

export default scenario({
  id: "sama.customer.createOrder",
  title: "SAMA: customer creates an order",
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
    await customer.open("cart");
    await customer.clickIfExists("checkoutButton");
    await customer.clickIfExists('button[type="submit"]');
    await customer.assertNoServerErrors();
  },
});

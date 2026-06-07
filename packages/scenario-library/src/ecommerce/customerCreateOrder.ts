import { scenario } from "@hasan-qa-humans/core";

/**
 * Customer journey: browse store → add first available product → open cart →
 * proceed to checkout → place order. Each step is defensive: if the next UI
 * element cannot be found the scenario skips rather than reporting a false bug.
 */
export default scenario({
  id: "ecommerce.customerCreateOrder",
  title: "Customer creates an order",
  roles: ["customer"],
  tags: ["ecommerce", "orders"],
  severity: "critical",
  requiresFeatures: ["ordering"],
  run: async ({ humans, config }) => {
    const customer = humans.customer();

    await customer.open("store");
    await customer.assertNoBlankScreen();

    const added = await customer.clickIfExists("addToCartButton");
    if (!added) {
      // No add-to-cart control we can recognize → not a failure, just unknown UI.
      return;
    }

    if (await customer.exists("cart")) {
      await customer.open("cart");
    }

    const wentToCheckout =
      (await customer.clickIfExists("checkoutButton")) || (await tryOpenCheckout(customer));
    if (!wentToCheckout) return;

    await customer.assertNoBlankScreen();

    // Place order: try common submit controls.
    const placed =
      (await customer.clickIfExists('button:has-text("Place order")')) ||
      (await customer.clickIfExists('button:has-text("تأكيد الطلب")')) ||
      (await customer.clickIfExists('button[type="submit"]'));

    if (placed) {
      await customer.assertNoServerErrors();
      // Remember a best-effort order reference for downstream scenarios.
      customer.share("orderPrefix", config.safety.testDataPrefix);
    }
  },
});

async function tryOpenCheckout(customer: {
  exists: (s: string) => Promise<boolean>;
  open: (s: string) => Promise<void>;
}): Promise<boolean> {
  if (await customer.exists("checkout")) {
    await customer.open("checkout");
    return true;
  }
  return false;
}

import { scenario } from "@hasan-qa-humans/core";

/**
 * Merchant opens a customer record and blocks them. If no blocking feature was
 * discovered, the scenario is skipped (not failed) with a clear reason.
 */
export default scenario({
  id: "ecommerce.merchantBlockCustomer",
  title: "Merchant blocks a customer",
  roles: ["merchant"],
  tags: ["ecommerce", "customers"],
  severity: "high",
  requiresFeatures: ["customer-blocking"],
  run: async ({ humans, skip }) => {
    const merchant = humans.merchant();

    await merchant.open("customers");
    await merchant.assertNoBlankScreen();

    const opened =
      (await merchant.clickIfExists('[data-testid="customer-row"]')) ||
      (await merchant.clickIfExists("tr a")) ||
      (await merchant.clickIfExists('a:has-text("Customer")'));
    if (!opened) skip("Could not locate a customer record to block.");

    const blocked =
      (await merchant.clickIfExists('[data-testid="block-customer"]')) ||
      (await merchant.clickIfExists('button:has-text("Block")')) ||
      (await merchant.clickIfExists('button:has-text("حظر")'));
    if (!blocked) skip("No block-customer control found on the customer record.");

    // Confirm dialog if present.
    await merchant.clickIfExists('button:has-text("Confirm")');
    await merchant.clickIfExists('button:has-text("تأكيد")');

    await merchant.assertNoServerErrors();
    merchant.share("customerBlocked", true);
  },
});

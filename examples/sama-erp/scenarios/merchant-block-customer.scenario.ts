import { scenario } from "@hasan-qa-humans/core";

export default scenario({
  id: "sama.merchant.blockCustomer",
  title: "SAMA: merchant blocks a customer",
  roles: ["merchant"],
  tags: ["ecommerce", "customers"],
  severity: "high",
  requiresFeatures: ["customer-blocking"],
  run: async ({ humans, skip }) => {
    const merchant = humans.merchant();
    await merchant.open("customers");
    await merchant.assertNoBlankScreen();
    const opened = await merchant.clickIfExists("tr a");
    if (!opened) skip("No customer record found to block.");
    const blocked =
      (await merchant.clickIfExists('button:has-text("Block")')) ||
      (await merchant.clickIfExists('button:has-text("حظر")'));
    if (!blocked) skip("No block control available.");
    await merchant.clickIfExists('button:has-text("Confirm")');
    await merchant.assertNoServerErrors();
    merchant.share("customerBlocked", true);
  },
});

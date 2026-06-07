import { scenario } from "@hasan-qa-humans/core";

/**
 * Logs in every role that has configured credentials (the runner performs the
 * actual login while acquiring each human and saves storageState) and verifies
 * the authenticated landing page renders without errors.
 */
export default scenario({
  id: "auth.login",
  title: "All configured roles can log in",
  roles: ["customer", "merchant", "merchantB", "agent", "employee", "admin"],
  tags: ["auth", "smoke"],
  severity: "high",
  run: async ({ humans, skip }) => {
    const available = ["customer", "merchant", "merchantB", "agent", "employee", "admin"].filter(
      (r) => humans.has(r),
    );
    if (available.length === 0) {
      skip("No role credentials configured — set QA_*_EMAIL / QA_*_PASSWORD in .env.qa.");
    }

    for (const role of available) {
      const human = humans.get(role);
      await human.assertNoBlankScreen();
      await human.assertNoServerErrors();
    }
  },
});

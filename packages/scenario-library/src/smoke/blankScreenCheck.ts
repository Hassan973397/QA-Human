import { scenario } from "@hasan-qa-humans/core";

/**
 * Focused check that the application's landing/home route renders an app shell
 * and is not a white screen of death.
 */
export default scenario({
  id: "smoke.blankScreen",
  title: "Smoke: home route is not a blank screen",
  roles: ["guest"],
  tags: ["smoke"],
  severity: "high",
  run: async ({ humans }) => {
    const guest = humans.guest();
    await guest.open("/");
    await guest.assertNoBlankScreen();
    await guest.assertNoCriticalConsoleErrors();
  },
});

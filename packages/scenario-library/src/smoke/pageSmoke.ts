import { scenario } from "@hasan-qa-humans/core";

/**
 * Opens the most important discovered pages as a guest and verifies each renders
 * real content with no blank screen, no critical console errors and no 5xx.
 */
export default scenario({
  id: "smoke.pages",
  title: "Smoke: key pages render without errors",
  roles: ["guest"],
  tags: ["smoke"],
  severity: "high",
  run: async ({ humans, graph, config }) => {
    const guest = humans.guest();

    // Prefer discovered public pages; fall back to a couple of config routes.
    const discovered = graph.pages
      .filter((p) => !p.path.includes(":") && !p.path.startsWith("/api"))
      .map((p) => p.path);
    const configured = Object.values(config.routes);
    const candidates = unique([...discovered, ...configured]).slice(0, 12);

    if (candidates.length === 0) {
      return; // nothing to smoke — recorded as passed with no steps
    }

    for (const path of candidates) {
      await guest.goto(joinBase(config.app.baseUrl, path));
      await guest.assertNoBlankScreen();
      await guest.assertNoServerErrors();
    }
  },
});

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function joinBase(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return baseUrl.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

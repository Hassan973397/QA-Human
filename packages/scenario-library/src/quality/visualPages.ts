import { scenario } from "@hasan-qa-humans/core";

/**
 * Visual regression over the key discovered/configured pages. First run records
 * baselines (pass); later runs fail if a page changed beyond the diff budget.
 * Refresh baselines with `hqa run --update-snapshots`.
 */
export default scenario({
  id: "visual.pages",
  title: "Visual regression: key pages match baseline",
  roles: ["guest"],
  tags: ["visual", "smoke"],
  severity: "medium",
  run: async ({ humans, graph, config, skip }) => {
    const guest = humans.guest();
    const discovered = graph.pages
      .filter((p) => !p.path.includes(":") && !p.path.startsWith("/api"))
      .map((p) => p.path);
    const pages = unique([...discovered, ...Object.values(config.routes)]).slice(0, 10);
    if (pages.length === 0) skip("No pages available for visual comparison.");

    for (const path of pages) {
      await guest.open(path);
      await guest.assertNoBlankScreen();
      await guest.expectVisualMatch(`page${path === "/" ? "-home" : path.replace(/\//g, "-")}`);
    }
  },
});

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

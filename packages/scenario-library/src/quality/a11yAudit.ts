import { scenario } from "@hasan-qa-humans/core";

/**
 * Accessibility audit (axe-core) over the key pages. Records every violation
 * and fails on those at/above the configured impact level (a11y.failOn).
 */
export default scenario({
  id: "a11y.audit",
  title: "Accessibility audit of key pages",
  roles: ["guest"],
  tags: ["a11y", "smoke"],
  severity: "medium",
  run: async ({ humans, graph, config, skip }) => {
    const guest = humans.guest();
    const discovered = graph.pages
      .filter((p) => !p.path.includes(":") && !p.path.startsWith("/api"))
      .map((p) => p.path);
    const pages = unique([...discovered, ...Object.values(config.routes)]).slice(0, 8);
    if (pages.length === 0) skip("No pages available to audit for accessibility.");

    for (const path of pages) {
      await guest.open(path);
      await guest.assertNoBlankScreen();
      await guest.auditAccessibility(path);
    }
  },
});

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

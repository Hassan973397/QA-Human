import { scenario } from "@hasan-qa-humans/core";

/**
 * Autonomous exploration: starting from home + configured routes, the guest
 * crawls same-origin links breadth-first (bounded), smoke-checking every page
 * for blank screens and server errors — like a human clicking around the app.
 * Set HQA_CRAWL_MAX to change the page budget (default 25).
 */
export default scenario({
  id: "explore.crawl",
  title: "Autonomous crawl: explore the app like a human",
  roles: ["guest"],
  tags: ["smoke", "explore"],
  severity: "high",
  run: async ({ humans, config }) => {
    const guest = humans.guest();
    const base = config.app.baseUrl.replace(/\/+$/, "");
    let origin = base;
    try {
      origin = new URL(base).origin;
    } catch {
      /* keep base */
    }

    const maxPages = Number(process.env.HQA_CRAWL_MAX) || 25;
    const seen = new Set<string>();
    const queue: string[] = ["/", ...Object.values(config.routes)];
    let visited = 0;

    while (queue.length > 0 && visited < maxPages) {
      const next = normalize(queue.shift()!);
      if (seen.has(next)) continue;
      seen.add(next);
      visited++;

      await guest.goto(join(base, next));
      await guest.assertNoBlankScreen();
      await guest.assertNoServerErrors();

      const links = await guest.page.evaluate((o: string) => {
        const out: string[] = [];
        for (const a of Array.from(document.querySelectorAll("a[href]"))) {
          const href = (a as HTMLAnchorElement).href;
          if (href.startsWith(o)) out.push(href);
        }
        return out;
      }, origin);

      for (const link of links) {
        try {
          queue.push(new URL(link).pathname);
        } catch {
          /* ignore malformed */
        }
      }
    }

    guest.remember("crawledPages", visited);
    guest.share("crawledPages", visited);
  },
});

function normalize(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    try {
      return new URL(path).pathname.replace(/\/+$/, "") || "/";
    } catch {
      return "/";
    }
  }
  const clean = path.split("#")[0]!.split("?")[0]!;
  return clean.replace(/\/+$/, "") || "/";
}

function join(base: string, path: string): string {
  return base + (path.startsWith("/") ? path : `/${path}`);
}

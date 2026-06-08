import type { ScenarioContext } from "@hasan-qa-humans/core";

/**
 * مساعد زحف مشترك: يبدأ من الجذر + صفحات الدراسة + مسارات الإعداد، ثم يتوسّع
 * عبر روابط نفس الأصل (عرضاً أولاً) بحدّ أقصى، وينفّذ ردّ نداء لكل صفحة يصلها.
 * يمنع تكرار منطق الزحف عبر سيناريوهات المراجعة المتعددة.
 */
export async function crawlPages(
  ctx: ScenarioContext,
  max: number,
  onPage: (path: string) => Promise<void>,
): Promise<number> {
  const guest = ctx.humans.guest();
  const base = ctx.config.app.baseUrl.replace(/\/+$/, "");
  let origin = base;
  try {
    origin = new URL(base).origin;
  } catch {
    /* keep base */
  }

  const discovered = ctx.graph.pages
    .filter((p) => !p.path.includes(":") && !p.path.startsWith("/api"))
    .map((p) => p.path);
  const seen = new Set<string>();
  const queue: string[] = ["/", ...discovered, ...Object.values(ctx.config.routes)];
  let visited = 0;

  while (queue.length > 0 && visited < max) {
    const next = normalize(queue.shift()!);
    if (seen.has(next)) continue;
    seen.add(next);
    visited++;

    await guest.goto(join(base, next));
    await guest.assertNoBlankScreen();
    await onPage(next);

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
  return visited;
}

export function normalize(path: string): string {
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

export function join(base: string, path: string): string {
  return base + (path.startsWith("/") ? path : `/${path}`);
}

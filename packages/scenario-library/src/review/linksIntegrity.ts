import { scenario } from "@hasan-qa-humans/core";
import { crawlPages } from "./crawlPages.js";

/**
 * سلامة الروابط والأصول: يزحف ويجمع كل رابط/صورة/سكربت/نمط من نفس الأصل،
 * ثم يتحقّق أن كلاً منها يردّ بحالة سليمة — يرصد الروابط المكسورة (٤٠٤) والأصول
 * التي تفشل (٥xx/تعذّر الوصول). حتمي بلا مفاتيح.
 */
export default scenario({
  id: "links.integrity",
  title: "Link & asset integrity: nothing broken across the app",
  roles: ["guest"],
  tags: ["review", "links", "smoke"],
  severity: "medium",
  run: async (ctx) => {
    const guest = ctx.humans.guest();
    let origin = ctx.config.app.baseUrl;
    try {
      origin = new URL(ctx.config.app.baseUrl).origin;
    } catch {
      /* keep */
    }
    const checked = new Set<string>();
    const max = Number(process.env.HQA_REVIEW_MAX) || 25;

    await crawlPages(ctx, max, async (path) => {
      if (checked.size > 300) return; // حدّ أمان لعدد الفحوص
      const urls: string[] = await guest.page.evaluate((o: string) => {
        const set = new Set<string>();
        const grab = (sel: string, attr: "href" | "src") => {
          for (const el of Array.from(document.querySelectorAll(sel))) {
            const v = (el as HTMLElement & Record<string, string>)[attr];
            if (v && v.startsWith(o)) set.add(v);
          }
        };
        grab("a[href]", "href");
        grab("img[src]", "src");
        grab("script[src]", "src");
        grab("link[href]", "href");
        return Array.from(set);
      }, origin);

      for (const url of urls) {
        if (checked.has(url) || checked.size > 300) continue;
        checked.add(url);
        try {
          const res = await fetch(url, { redirect: "follow" });
          if (res.status >= 400) {
            ctx.report.recordUxFindings([{
              scope: path, domain: "links",
              category: res.status >= 500 ? "links-5xx" : "links-broken",
              severity: res.status >= 500 ? "medium" : "low",
              title: `Broken resource (${res.status})`,
              detail: `${url} → HTTP ${res.status}`,
              suggestion: "Fix the target or remove the broken reference.",
            }]);
          }
        } catch (e) {
          ctx.report.recordUxFindings([{
            scope: path, domain: "links", category: "links-unreachable", severity: "low",
            title: "Unreachable resource",
            detail: `${url} → ${(e as Error).message}`,
            suggestion: "Fix the URL or ensure the host is reachable.",
          }]);
        }
      }
    });
  },
});

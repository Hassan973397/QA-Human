import { scenario } from "@hasan-qa-humans/core";

/**
 * مراجعة المنتج كصاحب المشروع: يزحف للتطبيق كإنسان (روابط نفس الأصل، عرضاً أولاً)
 * ويدقّق **كل صفحة يصل إليها** بعين صاحب العمل — عنصر ناقص (زر/عنوان)، تبويب
 * بمكان خطأ، حقل بلا تسمية، تنقّل مزدحم، رابط معطّل، معرّفات مكرّرة… الملاحظات
 * استشارية (لا تُفشِل التشغيل) ويجمعها التقرير في قسم «Product Review».
 *
 * لا يعتمد على جودة الاكتشاف ولا على مسارات الإعداد، فيغطّي أي مشروع.
 * عدّل سقف الصفحات عبر HQA_REVIEW_MAX (افتراضي ٢٥).
 */
export default scenario({
  id: "review.productOwner",
  title: "Product review: inspect every page like the project owner",
  roles: ["guest"],
  tags: ["review", "ux", "smoke"],
  severity: "medium",
  run: async ({ humans, graph, config }) => {
    const guest = humans.guest();
    const base = config.app.baseUrl.replace(/\/+$/, "");
    let origin = base;
    try {
      origin = new URL(base).origin;
    } catch {
      /* keep base */
    }

    const maxPages = Number(process.env.HQA_REVIEW_MAX) || 25;
    const seen = new Set<string>();
    // نبدأ من الجذر + ما اكتشفته الدراسة + مسارات الإعداد، ثم نتوسّع بالزحف
    const discovered = graph.pages
      .filter((p) => !p.path.includes(":") && !p.path.startsWith("/api"))
      .map((p) => p.path);
    const queue: string[] = ["/", ...discovered, ...Object.values(config.routes)];
    let reviewed = 0;

    while (queue.length > 0 && reviewed < maxPages) {
      const next = normalize(queue.shift()!);
      if (seen.has(next)) continue;
      seen.add(next);
      reviewed++;

      await guest.goto(join(base, next));
      await guest.assertNoBlankScreen();
      await guest.reviewPage(next);

      // اكتشاف روابط جديدة لمراجعتها (نفس الأصل فقط)
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

    guest.remember("reviewedPages", reviewed);
    guest.share("reviewedPages", reviewed);
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

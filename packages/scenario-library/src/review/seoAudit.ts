import { scenario } from "@hasan-qa-humans/core";
import { crawlPages } from "./crawlPages.js";

/**
 * تدقيق SEO والميتا لكل صفحة: عنوان مناسب، وصف ميتا، canonical، وسوم OpenGraph،
 * منع noindex غير المقصود، وlang — كي يظهر التطبيق جيداً في البحث والمشاركة.
 */
export default scenario({
  id: "seo.audit",
  title: "SEO & metadata audit across pages",
  roles: ["guest"],
  tags: ["review", "seo"],
  severity: "low",
  run: async (ctx) => {
    const guest = ctx.humans.guest();
    const max = Number(process.env.HQA_REVIEW_MAX) || 25;
    await crawlPages(ctx, max, (path) => guest.reviewSeo(path));
  },
});

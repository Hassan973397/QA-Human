import { scenario } from "@hasan-qa-humans/core";
import { crawlPages } from "./crawlPages.js";

/**
 * فحص سلامة المحتوى عبر الصفحات — نصوص مكسورة ظاهرة (undefined/NaN/[object Object]/
 * Invalid Date/قوالب غير مُستبدلة/lorem ipsum) واتجاه RTL للعربية.
 */
export default scenario({
  id: "content.sanity",
  title: "Content sanity: no broken text or wrong-direction RTL",
  roles: ["guest"],
  tags: ["review", "content", "i18n"],
  severity: "medium",
  run: async (ctx) => {
    const guest = ctx.humans.guest();
    const max = Number(process.env.HQA_REVIEW_MAX) || 25;
    await crawlPages(ctx, max, (path) => guest.reviewContent(path));
  },
});

import { scenario } from "@hasan-qa-humans/core";
import { crawlPages } from "./crawlPages.js";

/**
 * فحوص أمان أمامية عبر الصفحات — محتوى مختلط (http على https)، روابط _blank بلا
 * noopener، نماذج POST بلا CSRF، وكلمات مرور بلا سياسة autocomplete.
 */
export default scenario({
  id: "security.frontend",
  title: "Frontend security: mixed content, tabnabbing, CSRF hints",
  roles: ["guest"],
  tags: ["review", "security"],
  severity: "high",
  run: async (ctx) => {
    const guest = ctx.humans.guest();
    const max = Number(process.env.HQA_REVIEW_MAX) || 25;
    await crawlPages(ctx, max, (path) => guest.reviewSecurity(path));
  },
});

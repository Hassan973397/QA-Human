import { scenario } from "@hasan-qa-humans/core";
import { crawlPages } from "./crawlPages.js";

/**
 * مراجعة المنتج كصاحب المشروع: يزحف للتطبيق ويدقّق كل صفحة بعين صاحب العمل —
 * عنصر ناقص (زر/عنوان)، تبويب بمكان خطأ، حقل بلا تسمية، تنقّل مزدحم، رابط
 * معطّل، معرّفات مكرّرة — مع اقتراح إصلاح لكل ملاحظة (قسم Product Review).
 * استشاري (لا يُفشِل التشغيل) ويغطّي أي مشروع. السقف عبر HQA_REVIEW_MAX.
 */
export default scenario({
  id: "review.productOwner",
  title: "Product review: inspect every page like the project owner",
  roles: ["guest"],
  tags: ["review", "ux", "smoke"],
  severity: "medium",
  run: async (ctx) => {
    const guest = ctx.humans.guest();
    const max = Number(process.env.HQA_REVIEW_MAX) || 25;
    const n = await crawlPages(ctx, max, (path) => guest.reviewPage(path));
    guest.share("reviewedPages", n);
  },
});

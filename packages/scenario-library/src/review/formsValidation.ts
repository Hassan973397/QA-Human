import { scenario } from "@hasan-qa-humans/core";
import { crawlPages } from "./crawlPages.js";

/**
 * فحص تحقّق النماذج عبر التطبيق — بأمان تامّ بلا إرسال أي نموذج (لا يُنشئ بيانات
 * ولا يغيّر حالة). يرصد النماذج بلا تحقّق، حقول البريد غير المكتوبة كـ email،
 * وكلمات المرور بلا حدّ أدنى. يجيب «هذا الحقل يقبل أي شيء».
 */
export default scenario({
  id: "forms.validation",
  title: "Form validation: do inputs reject bad data?",
  roles: ["guest"],
  tags: ["review", "forms", "security"],
  severity: "medium",
  run: async (ctx) => {
    const guest = ctx.humans.guest();
    const max = Number(process.env.HQA_REVIEW_MAX) || 25;
    await crawlPages(ctx, max, (path) => guest.reviewForms(path));
  },
});

import { scenario } from "@hasan-qa-humans/core";
import { crawlPages } from "./crawlPages.js";

/**
 * تدقيق جودة التصميم والشكل (UI/UX): يزحف لكل صفحة ويفحص «جمالها ومناسبتها» —
 * تباين نصّ ضعيف، خطوط دقيقة، أزرار صغيرة، صور مكسورة، تجاوز أفقي يكسر التخطيط،
 * وفوضى الهوية البصرية (خطوط/أحجام/ألوان كثيرة). يجيب سؤال «شكلها غير مناسب».
 */
export default scenario({
  id: "ui.designQuality",
  title: "Design quality: is every page polished and consistent?",
  roles: ["guest"],
  tags: ["review", "ui", "ux"],
  severity: "medium",
  run: async (ctx) => {
    const guest = ctx.humans.guest();
    const max = Number(process.env.HQA_REVIEW_MAX) || 25;
    await crawlPages(ctx, max, (path) => guest.reviewDesign(path));
  },
});

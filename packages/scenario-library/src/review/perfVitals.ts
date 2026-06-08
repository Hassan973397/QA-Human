import { scenario } from "@hasan-qa-humans/core";
import { crawlPages } from "./crawlPages.js";

/**
 * قياس الأداء وCore Web Vitals لكل صفحة — LCP/CLS/TBT ووزن الصفحة وعدد الطلبات،
 * مع ميزانيات معقولة. يجيب «الصفحة بطيئة/ثقيلة/تقفز أثناء التحميل».
 */
export default scenario({
  id: "perf.vitals",
  title: "Performance & Core Web Vitals across pages",
  roles: ["guest"],
  tags: ["review", "performance"],
  severity: "medium",
  run: async (ctx) => {
    const guest = ctx.humans.guest();
    const max = Math.min(Number(process.env.HQA_REVIEW_MAX) || 25, 12);
    await crawlPages(ctx, max, (path) => guest.reviewVitals(path));
  },
});

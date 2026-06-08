import { scenario } from "@hasan-qa-humans/core";
import { crawlPages } from "./crawlPages.js";

/**
 * فحص الاستجابة (Responsive): يفتح كل صفحة بمقاس هاتف ثم لوحي ويكشف كسر
 * التخطيط (تجاوز أفقي/تمرير جانبي) — يجيب «شكلها مختلف/مكسور على الجوال».
 */
export default scenario({
  id: "ui.responsive",
  title: "Responsive layout: do pages hold up on phone & tablet?",
  roles: ["guest"],
  tags: ["review", "ui", "responsive"],
  severity: "medium",
  run: async (ctx) => {
    const guest = ctx.humans.guest();
    const vp = ctx.config.browser.viewport;
    const max = Math.min(Number(process.env.HQA_REVIEW_MAX) || 25, 10);
    await crawlPages(ctx, max, async () => {
      await guest.page.setViewportSize({ width: 375, height: 812 });
      await guest.checkResponsive("mobile 375px");
      await guest.page.setViewportSize({ width: 768, height: 1024 });
      await guest.checkResponsive("tablet 768px");
      await guest.page.setViewportSize({ width: vp.width, height: vp.height });
    });
  },
});

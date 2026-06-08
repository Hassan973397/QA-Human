import { scenario, auditStaticCode } from "@hasan-qa-humans/core";

/**
 * تدقيق ثابت لمصدر المشروع (باك إند + قاعدة بيانات + كل الكود) — يكمّل الاختبار
 * الخارجي: أسرار مكتوبة بالكود، حقن SQL، المال كـ float (مخالفة قانون هاسان)،
 * eval، حقن أوامر، XSS عبر innerHTML، وملف .env مكشوف. يقرأ الملفات فقط.
 */
export default scenario({
  id: "audit.static",
  title: "Static code audit: secrets, SQL injection, money-as-float, XSS",
  roles: ["guest"],
  tags: ["review", "code", "security", "backend"],
  severity: "high",
  run: async (ctx) => {
    const findings = await auditStaticCode(ctx.config.discovery);
    ctx.report.recordUxFindings(findings);
  },
});

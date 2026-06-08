import { scenario, auditApi } from "@hasan-qa-humans/core";

/**
 * تدقيق أمان الباك إند/الـAPI: رؤوس الأمان (CSP, X-Frame, nosniff, Referrer,
 * HSTS)، أعلام الكوكيز (HttpOnly/Secure/SameSite)، كشف إصدار الخادم، CORS
 * المتساهل، الضغط، ومعالجة الأخطاء (٤٠٤/٥٠٠ وتسريب آثار التتبّع). حتمي بلا مفاتيح.
 */
export default scenario({
  id: "api.security",
  title: "Backend/API hardening: headers, cookies, errors",
  roles: ["guest"],
  tags: ["review", "api", "security"],
  severity: "medium",
  run: async (ctx) => {
    const paths = Array.from(new Set(["/", ...Object.values(ctx.config.routes)]));
    const findings = await auditApi(ctx.config.app.baseUrl, paths);
    ctx.report.recordUxFindings(findings);
  },
});

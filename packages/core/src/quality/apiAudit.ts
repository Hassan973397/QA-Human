import type { UxFinding } from "../reporting/types.js";

/**
 * تدقيق الباك إند والـAPI كصاحب منتج مسؤول عن الأمان والمتانة — يفحص استجابات
 * الخادم: رؤوس الأمان (CSP, X-Frame-Options, nosniff, Referrer-Policy, HSTS)،
 * أعلام الكوكيز (HttpOnly/Secure/SameSite)، كشف إصدار الخادم، CORS المتساهل،
 * ضغط النقل، ومعالجة الأخطاء (٤٠٤/٥٠٠ وتسريب آثار التتبّع). حتمي بلا مفاتيح.
 */
export async function auditApi(baseUrl: string, paths: string[]): Promise<UxFinding[]> {
  const out: UxFinding[] = [];
  const base = baseUrl.replace(/\/+$/, "");
  const isHttps = base.toLowerCase().startsWith("https:");
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base);

  const f = (
    scope: string,
    category: string,
    severity: UxFinding["severity"],
    title: string,
    detail: string,
    suggestion: string,
  ): void => {
    out.push({ scope, domain: "api", category, severity, title, detail, suggestion });
  };

  // فحص الوثيقة الرئيسة: الرؤوس والكوكيز والضغط
  try {
    const res = await fetch(base + "/", { redirect: "manual" });
    const h = res.headers;
    const need: Array<[string, string, UxFinding["severity"], string]> = [
      ["content-security-policy", "csp", "medium", "Content-Security-Policy mitigates XSS/injection."],
      ["x-content-type-options", "nosniff", "low", "X-Content-Type-Options: nosniff stops MIME sniffing."],
      ["referrer-policy", "referrer", "low", "Referrer-Policy limits leaked URLs."],
    ];
    for (const [name, cat, sev, why] of need) {
      if (!h.get(name)) {
        f(base, `api-missing-${cat}`, sev, `Missing ${name} header`,
          `Response has no ${name} header.`, `Add ${name}. ${why}`);
      }
    }
    const frame = h.get("x-frame-options") || (h.get("content-security-policy") || "").includes("frame-ancestors");
    if (!frame) {
      f(base, "api-clickjacking", "medium", "No clickjacking protection",
        "No X-Frame-Options and no CSP frame-ancestors.",
        "Add X-Frame-Options: DENY (or CSP frame-ancestors) to prevent clickjacking.");
    }
    if (isHttps && !h.get("strict-transport-security")) {
      f(base, "api-no-hsts", "low", "No HSTS header",
        "HTTPS response has no Strict-Transport-Security.",
        "Add HSTS so browsers force HTTPS.");
    }
    const banner = h.get("server") || h.get("x-powered-by");
    if (banner && /\d/.test(banner)) {
      f(base, "api-version-disclosure", "low", "Server version disclosed",
        `The server advertises "${banner}".`,
        "Hide Server / X-Powered-By version banners to reduce fingerprinting.");
    }
    const cookie = h.get("set-cookie");
    if (cookie) {
      const lc = cookie.toLowerCase();
      if (!lc.includes("httponly")) f(base, "api-cookie-httponly", "medium", "Cookie without HttpOnly",
        "A Set-Cookie is missing HttpOnly.", "Add HttpOnly so scripts can't read session cookies.");
      if (isHttps && !lc.includes("secure")) f(base, "api-cookie-secure", "medium", "Cookie without Secure",
        "A Set-Cookie over HTTPS is missing Secure.", "Add Secure so cookies are HTTPS-only.");
      if (!lc.includes("samesite")) f(base, "api-cookie-samesite", "low", "Cookie without SameSite",
        "A Set-Cookie has no SameSite.", "Add SameSite=Lax/Strict to mitigate CSRF.");
    }
    const cors = h.get("access-control-allow-origin");
    if (cors === "*" && h.get("access-control-allow-credentials") === "true") {
      f(base, "api-cors-wildcard", "medium", "Over-permissive CORS",
        "Access-Control-Allow-Origin: * with credentials enabled.",
        "Never combine wildcard CORS with credentials; allow specific origins.");
    }
    if (!isHttps && !isLocal) {
      f(base, "api-no-https", "medium", "Served over HTTP",
        "The app is served without HTTPS.", "Serve over HTTPS to protect traffic.");
    }
    const ce = h.get("content-encoding") || "";
    const len = Number(h.get("content-length") || "0");
    if (len > 4096 && !/gzip|br|deflate/.test(ce)) {
      f(base, "api-no-compression", "low", "Responses not compressed",
        `A ${len}-byte response has no gzip/br compression.`,
        "Enable gzip/brotli to cut payload size and load time.");
    }
  } catch (err) {
    f(base, "api-unreachable", "low", "Base URL not reachable for header audit",
      `Could not fetch ${base}: ${(err as Error).message}.`, "Ensure the app is running and reachable.");
  }

  // معالجة الأخطاء: مسار غير موجود يجب أن يرجّع ٤٠٤ بلا تسريب آثار تتبّع
  try {
    const probe = base + "/__hqa_nonexistent_" + "x9z";
    const res = await fetch(probe, { redirect: "manual" });
    const body = (await res.text().catch(() => "")).slice(0, 4000);
    if (res.status === 200) {
      f(probe, "api-no-404", "low", "Unknown route returns 200",
        "A nonexistent path returned HTTP 200 instead of 404.",
        "Return 404 for unknown routes so crawlers and users get correct signals.");
    } else if (res.status >= 500) {
      f(probe, "api-error-5xx", "medium", "Unknown route crashes (5xx)",
        `A nonexistent path returned HTTP ${res.status}.`,
        "Handle unknown routes gracefully with a 404, not a server error.");
    }
    if (/\b(at\s+\/?\w+.*:\d+:\d+|Traceback \(most recent call last\)|Exception in|\.java:\d+|node_modules)\b/.test(body)) {
      f(probe, "api-stacktrace-leak", "high", "Error leaks a stack trace",
        "An error response exposes internal stack-trace / file paths.",
        "Return a generic error page; log details server-side only.");
    }
  } catch {
    /* probe is best-effort */
  }
  void paths;
  return out;
}

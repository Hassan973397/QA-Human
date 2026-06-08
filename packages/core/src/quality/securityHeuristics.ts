import type { Page } from "playwright";
import type { RawUxFinding } from "./uxHeuristics.js";

/**
 * فحوص أمان أمامية على مستوى الصفحة — محتوى مختلط (http على https)، روابط
 * target=_blank بلا rel=noopener (اختطاف تبويب)، نماذج POST بلا حقل CSRF،
 * وحقول كلمة مرور تسمح بالحفظ التلقائي. حتمي عبر DOM.
 */
export async function auditFrontendSecurity(page: Page): Promise<RawUxFinding[]> {
  return page.evaluate(() => {
    const out: RawUxFinding[] = [];
    const PER = 4;
    const counts: Record<string, number> = {};
    const add = (f: Omit<RawUxFinding, "domain">): void => {
      counts[f.category] = (counts[f.category] ?? 0) + 1;
      if (counts[f.category]! <= PER) out.push({ ...f, domain: "security" });
    };
    const hint = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const id = el.getAttribute("id");
      return id ? `${tag}#${id}` : tag;
    };

    const https = location.protocol === "https:";

    // محتوى مختلط
    if (https) {
      const attrs: Array<[string, string]> = [["img[src]", "src"], ["script[src]", "src"], ["link[href]", "href"], ["iframe[src]", "src"]];
      for (const [sel, attr] of attrs) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const v = el.getAttribute(attr) || "";
          if (v.startsWith("http://")) {
            add({ category: "sec-mixed-content", severity: "medium", title: "Mixed content over HTTPS",
              detail: `An HTTPS page loads an http:// resource: ${v.slice(0, 80)}.`,
              suggestion: "Serve all resources over HTTPS; browsers block/insecure mixed content.", selector: hint(el) });
          }
        }
      }
    }

    // روابط target=_blank بلا noopener
    for (const a of Array.from(document.querySelectorAll('a[target="_blank"]'))) {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      if (!rel.includes("noopener")) {
        add({ category: "sec-tabnabbing", severity: "medium", title: "target=_blank without rel=noopener",
          detail: "A new-tab link lacks rel=noopener — the opened page can hijack window.opener.",
          suggestion: 'Add rel="noopener noreferrer" to target=_blank links.', selector: hint(a) });
      }
    }

    // نماذج POST بلا حقل CSRF ظاهر، وكلمات مرور تسمح بالحفظ
    for (const form of Array.from(document.querySelectorAll("form"))) {
      const method = (form.getAttribute("method") || "").toLowerCase();
      const hasPassword = !!form.querySelector('input[type="password"]');
      if (method === "post" || hasPassword) {
        const tokens = Array.from(form.querySelectorAll('input[type="hidden"]')).some((i) =>
          /csrf|xsrf|token|authenticity/i.test((i.getAttribute("name") || "") + (i.getAttribute("id") || "")),
        );
        if (!tokens) {
          add({ category: "sec-csrf-hint", severity: "low", title: "Form has no visible CSRF token",
            detail: "A state-changing form has no hidden CSRF token field (it may use a header instead).",
            suggestion: "Protect state-changing forms with a CSRF token or SameSite cookies + header check.", selector: hint(form) });
        }
      }
      for (const pw of Array.from(form.querySelectorAll('input[type="password"]'))) {
        const ac = (pw.getAttribute("autocomplete") || "").toLowerCase();
        if (!ac) {
          add({ category: "sec-password-autocomplete", severity: "low", title: "Password field without autocomplete policy",
            detail: "A password input has no autocomplete attribute.",
            suggestion: 'Set autocomplete (e.g. "current-password"/"new-password") to control credential storage.', selector: hint(pw) });
        }
      }
    }

    for (const [cat, n] of Object.entries(counts)) {
      if (n > PER) out.push({ domain: "security", category: `${cat}-more`, severity: "low",
        title: "More of the same", detail: `${n - PER} more "${cat}" instance(s).`,
        suggestion: "Apply the fix across the page/site." });
    }
    return out;
  });
}

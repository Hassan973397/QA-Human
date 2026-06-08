import type { Page } from "playwright";
import type { RawUxFinding } from "./uxHeuristics.js";

/**
 * فحص تحقّق النماذج كمختبِر بشري حريص — لكن **بأمان تامّ بلا إرسال أي نموذج**
 * (كي لا يُنشئ بيانات أو يغيّر حالة). يفحص قيود التحقّق في المتصفح: نموذج بلا أي
 * تحقّق، حقل بريد غير مكتوب كـ email، كلمة مرور بلا حدّ أدنى، حقل مطلوب بلا
 * علامة required. يجيب «هذا الحقل يقبل أي شيء/لا يتحقّق».
 */
export async function auditForms(page: Page): Promise<RawUxFinding[]> {
  return page.evaluate(() => {
    const out: RawUxFinding[] = [];
    const add = (f: Omit<RawUxFinding, "domain">): void => {
      out.push({ ...f, domain: "forms" });
    };
    const hint = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const id = el.getAttribute("id");
      if (id) return `${tag}#${id}`;
      const name = el.getAttribute("name");
      return name ? `${tag}[name="${name}"]` : tag;
    };

    const forms = Array.from(document.querySelectorAll("form"));
    forms.forEach((form, idx) => {
      const fields = Array.from(
        form.querySelectorAll("input,select,textarea"),
      ).filter((el) => {
        const t = (el.getAttribute("type") || "").toLowerCase();
        return !["hidden", "submit", "button", "reset", "image"].includes(t);
      });
      if (fields.length === 0) return;

      const hasAnyConstraint = fields.some((el) => {
        const t = (el.getAttribute("type") || "").toLowerCase();
        return (
          el.hasAttribute("required") ||
          el.hasAttribute("pattern") ||
          el.hasAttribute("min") ||
          el.hasAttribute("max") ||
          el.hasAttribute("minlength") ||
          el.hasAttribute("maxlength") ||
          ["email", "url", "number", "tel", "date"].includes(t)
        );
      });
      if (!hasAnyConstraint) {
        add({ category: "form-no-validation", severity: "medium", title: "Form has no input validation",
          detail: `A form with ${fields.length} field(s) declares no required/type/pattern constraints.`,
          suggestion: "Add client-side validation (required, type=email, pattern, min/max) and validate server-side too.",
          selector: hint(form) || `form#${idx}` });
      }

      fields.forEach((el) => {
        const name = (el.getAttribute("name") || el.getAttribute("id") || "").toLowerCase();
        const type = (el.getAttribute("type") || "").toLowerCase();
        if (/e[-_]?mail/.test(name) && type !== "email") {
          add({ category: "form-email-untyped", severity: "low", title: "Email field not validated as email",
            detail: "An email-looking field is not type=email.",
            suggestion: "Use type=email (or a pattern) so invalid addresses are caught.", selector: hint(el) });
        }
        if (type === "password" && !el.hasAttribute("minlength")) {
          add({ category: "form-password-no-min", severity: "low", title: "Password has no minimum length",
            detail: "A password field has no minlength rule.",
            suggestion: "Set a sensible minlength (e.g. 8) to nudge stronger passwords.", selector: hint(el) });
        }
      });
    });
    return out;
  });
}

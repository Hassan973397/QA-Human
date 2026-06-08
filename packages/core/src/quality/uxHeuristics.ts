import type { Page } from "playwright";

/**
 * محرّك تدقيق المنتج/التجربة — يفحص صفحة محمّلة كما يفعل صاحب المشروع:
 * هل ينقص زر؟ هل التبويبات بمكانها؟ حقل بلا تسمية؟ تنقّل مزدحم؟ روابط معطّلة؟
 * كل الفحوص حتمية (DOM فقط) وتعمل على أي تطبيق ويب بلا إعداد ولا مفاتيح خارجية.
 */
export interface RawUxFinding {
  category: string;
  severity: "low" | "medium";
  title: string;
  detail: string;
  suggestion: string;
  selector?: string;
  /** الطبقة (ux افتراضياً): ui | seo | responsive | api | links. */
  domain?: string;
}

/**
 * يشغّل التدقيق داخل سياق الصفحة (page.evaluate) ويُرجع ملاحظات خام.
 * الدالة الداخلية نقيّة DOM — لا تعتمد على أي مكتبة، لتعمل في أي متصفح.
 */
export async function auditPageHeuristics(page: Page): Promise<RawUxFinding[]> {
  return page.evaluate(() => {
    const out: RawUxFinding[] = [];
    const PER_CATEGORY = 4; // سقف لكل تصنيف كي لا تُغرق التقارير
    const counts: Record<string, number> = {};

    const add = (f: RawUxFinding): void => {
      counts[f.category] = (counts[f.category] ?? 0) + 1;
      if (counts[f.category]! <= PER_CATEGORY) out.push(f);
    };

    // تلميح مقروء لتحديد العنصر في DOM
    const hint = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const id = el.getAttribute("id");
      if (id) return `${tag}#${id}`;
      const testid = el.getAttribute("data-testid");
      if (testid) return `${tag}[data-testid="${testid}"]`;
      const cls = (el.getAttribute("class") || "").trim().split(/\s+/)[0];
      if (cls) return `${tag}.${cls}`;
      return tag;
    };

    const txt = (el: Element): string => (el.textContent || "").replace(/\s+/g, " ").trim();

    // الاسم المتاح لعنصر تفاعلي (نص/aria/عنوان/بديل صورة)
    const accName = (el: Element): string => {
      const aria = el.getAttribute("aria-label");
      if (aria && aria.trim()) return aria.trim();
      if (el.getAttribute("aria-labelledby")) return "labelledby";
      const title = el.getAttribute("title");
      if (title && title.trim()) return title.trim();
      const t = txt(el);
      if (t) return t;
      const img = el.querySelector("img[alt]");
      const alt = img?.getAttribute("alt");
      if (alt && alt.trim()) return alt.trim();
      return "";
    };

    // ── بنية الصفحة ──
    if (!document.title || !document.title.trim()) {
      add({ category: "missing-title", severity: "low", title: "Page has no <title>",
        detail: "The document title is empty.",
        suggestion: "Set a descriptive <title> for the tab and SEO." });
    }
    if (!document.documentElement.getAttribute("lang")) {
      add({ category: "missing-lang", severity: "low", title: "Missing <html lang>",
        detail: "The root element has no lang attribute.",
        suggestion: 'Add lang (e.g. <html lang="en"> or "ar") for screen readers and translation.' });
    }
    if (!document.querySelector('meta[name="viewport"]')) {
      add({ category: "missing-viewport", severity: "low", title: "No mobile viewport meta",
        detail: "No <meta name=viewport> found.",
        suggestion: "Add the viewport meta so the page is usable on phones." });
    }
    const h1s = document.querySelectorAll("h1");
    if (h1s.length === 0) {
      add({ category: "no-h1", severity: "low", title: "Page has no main heading",
        detail: "No <h1> on the page.",
        suggestion: "Add one clear <h1> so users know what this page is." });
    } else if (h1s.length > 1) {
      add({ category: "multiple-h1", severity: "low", title: "Multiple <h1> headings",
        detail: `Found ${h1s.length} <h1> elements.`,
        suggestion: "Keep a single <h1>; use <h2>+ for sub-sections." });
    }
    if (!document.querySelector("main, [role=main]")) {
      add({ category: "no-main-landmark", severity: "low", title: "No main landmark",
        detail: "No <main> / role=main region.",
        suggestion: "Wrap primary content in <main> for structure and a11y." });
    }

    // ── التنقّل والتبويبات ──
    document.querySelectorAll("nav, [role=navigation]").forEach((nav) => {
      const items = nav.querySelectorAll("a[href], button");
      if (items.length > 8) {
        add({ category: "nav-overflow", severity: "medium", title: "Crowded navigation",
          detail: `A navigation region has ${items.length} top-level items.`,
          suggestion: "Group secondary items under a menu/dropdown to reduce clutter.",
          selector: hint(nav) });
      }
    });
    const tabs = document.querySelectorAll("[role=tab]");
    const panels = document.querySelectorAll("[role=tabpanel]");
    if (tabs.length > 0 && panels.length === 0) {
      add({ category: "tabs-without-panel", severity: "medium", title: "Tabs without panels",
        detail: `${tabs.length} tab(s) but no tabpanel — tab content may be missing or misplaced.`,
        suggestion: "Pair each tab with a role=tabpanel so its content shows in the right place." });
    }
    if (tabs.length > 0 && !Array.from(tabs).some((t) => t.getAttribute("aria-selected") === "true")) {
      add({ category: "tabs-no-active", severity: "medium", title: "No active tab",
        detail: "A tab group has no tab marked aria-selected=true.",
        suggestion: "Mark the current tab active so users know where they are." });
    }

    // ── الأزرار والروابط ──
    document.querySelectorAll("button").forEach((b) => {
      if (!accName(b)) {
        add({ category: "empty-button-label", severity: "medium", title: "Button with no label",
          detail: "A <button> has no text or aria-label.",
          suggestion: "Give the button a clear label so users know what it does.",
          selector: hint(b) });
      }
    });
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!accName(a)) {
        add({ category: "empty-link-label", severity: "medium", title: "Link with no label",
          detail: "A link has no visible text or aria-label.",
          suggestion: "Add descriptive link text (avoid empty or icon-only links).",
          selector: hint(a) });
      }
      if (href === "#" || href.trim() === "" || href.toLowerCase().startsWith("javascript:")) {
        add({ category: "dead-link", severity: "low", title: "Link goes nowhere",
          detail: `A link points to "${href || "(empty)"}".`,
          suggestion: "Point the link to a real route, or make it a <button> if it triggers an action.",
          selector: hint(a) });
      }
    });

    // ── النماذج والحقول ──
    document.querySelectorAll("form").forEach((form) => {
      const fields = form.querySelectorAll(
        "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), select, textarea",
      );
      const submit = form.querySelector("button[type=submit], input[type=submit], button:not([type])");
      const anyButton = form.querySelector("button, input[type=submit]");
      if (fields.length >= 2 && !submit && !anyButton) {
        add({ category: "form-maybe-no-submit", severity: "medium", title: "Form may need a submit button",
          detail: `A form has ${fields.length} fields but no visible submit button.`,
          suggestion: "Add a clear submit button so users can complete the form.",
          selector: hint(form) });
      }
    });
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) return;
      const id = el.getAttribute("id");
      const labelled =
        (id && document.querySelector(`label[for="${id}"]`)) ||
        el.closest("label") ||
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.getAttribute("placeholder") ||
        el.getAttribute("title");
      if (!labelled) {
        add({ category: "input-no-label", severity: "medium", title: "Input with no label",
          detail: "A form field has no label, aria-label, or placeholder.",
          suggestion: "Add a <label> (or aria-label) so users know what to type.",
          selector: hint(el) });
      }
    });

    // ── الصور وتكرار المعرّفات ──
    const noAlt = document.querySelectorAll("img:not([alt])");
    if (noAlt.length > 0) {
      add({ category: "images-no-alt", severity: "low", title: "Images without alt text",
        detail: `${noAlt.length} <img> without an alt attribute.`,
        suggestion: "Add alt text (empty alt for decorative images)." });
    }
    const idCount: Record<string, number> = {};
    document.querySelectorAll("[id]").forEach((el) => {
      const id = el.getAttribute("id")!;
      idCount[id] = (idCount[id] ?? 0) + 1;
    });
    Object.entries(idCount)
      .filter(([, n]) => n > 1)
      .forEach(([id, n]) => {
        add({ category: "duplicate-id", severity: "medium", title: "Duplicate element id",
          detail: `id="${id}" is used ${n} times.`,
          suggestion: "Make ids unique — duplicates break labels, anchors, and scripts." });
      });

    // ملخّص عند تجاوز السقف لأي تصنيف
    for (const [cat, n] of Object.entries(counts)) {
      if (n > PER_CATEGORY) {
        out.push({ category: `${cat}-more`, severity: "low", title: "More of the same",
          detail: `${n - PER_CATEGORY} additional "${cat}" finding(s) not listed individually.`,
          suggestion: "Fix the pattern across the page, not just the listed instances." });
      }
    }
    return out;
  });
}

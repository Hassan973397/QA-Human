import type { Page } from "playwright";
import type { RawUxFinding } from "./uxHeuristics.js";

/**
 * فحص سلامة المحتوى المعروض كمختبِر بشري دقيق — يرصد نصوصاً مكسورة تظهر للمستخدم:
 * undefined / null / NaN / [object Object] / Invalid Date / lorem ipsum / قوالب
 * غير مُستبدلة {{x}} أو ${x} / %s. ويفحص اتجاه RTL: نصّ عربي يُعرض من اليسار.
 */
export async function auditContentSanity(page: Page): Promise<RawUxFinding[]> {
  return page.evaluate(() => {
    const out: RawUxFinding[] = [];
    const PER = 4;
    const counts: Record<string, number> = {};
    const add = (f: Omit<RawUxFinding, "domain">): void => {
      counts[f.category] = (counts[f.category] ?? 0) + 1;
      if (counts[f.category]! <= PER) out.push({ ...f, domain: "content" });
    };
    const hint = (el: Element | null): string => {
      if (!el) return "";
      const tag = el.tagName.toLowerCase();
      const id = el.getAttribute("id");
      if (id) return `${tag}#${id}`;
      const cls = (el.getAttribute("class") || "").trim().split(/\s+/)[0];
      return cls ? `${tag}.${cls}` : tag;
    };
    const visible = (el: Element | null): boolean => {
      if (!el) return false;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.visibility !== "hidden" && s.display !== "none" && r.width > 0 && r.height > 0;
    };

    const broken: Array<[RegExp, string, string]> = [
      [/\[object Object\]/, "content-object-object", "Rendered \"[object Object]\""],
      [/\bundefined\b/, "content-undefined", 'Rendered the word "undefined"'],
      [/(^|[\s:>$])NaN\b/, "content-nan", 'Rendered "NaN"'],
      [/\bInvalid Date\b/, "content-invalid-date", 'Rendered "Invalid Date"'],
      [/\bnull\b/, "content-null", 'Rendered the word "null"'],
      [/\{\{\s*[\w.]+\s*\}\}/, "content-template", "Unrendered template placeholder {{…}}"],
      [/\$\{[\w.]+\}/, "content-template", "Unrendered template literal ${…}"],
      [/lorem ipsum/i, "content-lorem", "Placeholder lorem-ipsum text"],
      [/%[sdif]\b/, "content-format", "Leftover format specifier (%s/%d)"],
    ];

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let scanned = 0;
    while ((node = walker.nextNode()) && scanned < 4000) {
      scanned++;
      const text = (node.textContent || "").trim();
      if (!text || text.length > 300) continue;
      const parent = node.parentElement;
      if (!visible(parent)) continue;
      if (parent && /^(script|style|noscript)$/i.test(parent.tagName)) continue;
      for (const [re, category, title] of broken) {
        if (re.test(text)) {
          add({ category, severity: category === "content-null" || category === "content-format" ? "low" : "medium",
            title, detail: `"${text.slice(0, 80)}"`,
            suggestion: "Fix the data/formatting so users never see broken or placeholder values.",
            selector: hint(parent) });
          break;
        }
      }
    }

    // RTL: نصّ عربي يُعرض باتجاه LTR
    const arabic = /[؀-ۿ]/;
    let rtlChecked = 0;
    for (const el of Array.from(document.querySelectorAll("p,span,div,li,h1,h2,h3,td,label,a,button"))) {
      if (rtlChecked > 600) break;
      const direct = Array.from(el.childNodes).some((n) => n.nodeType === 3 && arabic.test(n.textContent || ""));
      if (!direct || !visible(el)) continue;
      rtlChecked++;
      if (getComputedStyle(el).direction !== "rtl") {
        add({ category: "content-rtl-direction", severity: "medium", title: "Arabic text rendered left-to-right",
          detail: "An element with Arabic text has direction:ltr — punctuation and alignment will look wrong.",
          suggestion: 'Set dir="rtl" (or CSS direction:rtl) on Arabic content.', selector: hint(el) });
      }
    }

    for (const [cat, n] of Object.entries(counts)) {
      if (n > PER) out.push({ domain: "content", category: `${cat}-more`, severity: "low",
        title: "More of the same", detail: `${n - PER} more "${cat}" occurrence(s).`,
        suggestion: "Fix the underlying data/formatting source." });
    }
    return out;
  });
}

import type { Page } from "playwright";
import type { RawUxFinding } from "./uxHeuristics.js";

/**
 * محرّك جودة التصميم والواجهة (UI/UX) — يفحص «شكل» الصفحة كما يراه صاحب المنتج:
 * نصّ بتباين ضعيف يصعب قراءته، خطوط دقيقة جداً، أزرار صغيرة لا تُنقر بسهولة،
 * صور مكسورة، تجاوز أفقي يكسر التخطيط، وفوضى الهوية (خطوط/أحجام/ألوان كثيرة).
 * كل الفحوص حتمية عبر الأنماط المحسوبة (computed styles)، بلا مفاتيح خارجية.
 */
export async function auditUiQuality(page: Page): Promise<RawUxFinding[]> {
  return page.evaluate(() => {
    const out: RawUxFinding[] = [];
    const PER = 3;
    const counts: Record<string, number> = {};
    const add = (f: Omit<RawUxFinding, "domain">): void => {
      counts[f.category] = (counts[f.category] ?? 0) + 1;
      if (counts[f.category]! <= PER) out.push({ ...f, domain: "ui" });
    };
    const hint = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const id = el.getAttribute("id");
      if (id) return `${tag}#${id}`;
      const cls = (el.getAttribute("class") || "").trim().split(/\s+/)[0];
      return cls ? `${tag}.${cls}` : tag;
    };
    const visible = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };

    // تحويل لون محسوب إلى [r,g,b,a]
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 1];
      const p = m[1]!.split(",").map((x) => parseFloat(x.trim()));
      return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
    };
    const lum = (r: number, g: number, b: number): number => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    // لون الخلفية الفعّال (يصعد للأسلاف حتى يجد خلفية غير شفافة)
    const bgOf = (el: Element): [number, number, number] => {
      let node: Element | null = el;
      while (node) {
        const [r, g, b, a] = parse(getComputedStyle(node).backgroundColor);
        if (a > 0) return [r, g, b];
        node = node.parentElement;
      }
      return [255, 255, 255];
    };
    const contrast = (fg: [number, number, number], bg: [number, number, number]): number => {
      const l1 = lum(...fg) + 0.05;
      const l2 = lum(...bg) + 0.05;
      return l1 > l2 ? l1 / l2 : l2 / l1;
    };

    const fonts = new Set<string>();
    const sizes = new Set<string>();
    const colors = new Set<string>();

    const textEls = Array.from(document.querySelectorAll("p,span,a,button,li,td,th,label,h1,h2,h3,h4,h5,h6,div"))
      .filter((el) => {
        const t = (el.textContent || "").trim();
        const direct = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim());
        return t.length > 0 && direct && visible(el);
      })
      .slice(0, 400);

    for (const el of textEls) {
      const s = getComputedStyle(el);
      fonts.add(s.fontFamily);
      sizes.add(s.fontSize);
      colors.add(s.color);
      const px = parseFloat(s.fontSize);
      if (px && px < 12) {
        add({ category: "tiny-font", severity: "low", title: "Text is very small",
          detail: `Text rendered at ${s.fontSize} (below 12px) is hard to read.`,
          suggestion: "Use at least 14–16px for body text.", selector: hint(el) });
      }
      const fg = parse(s.color);
      const ratio = contrast([fg[0], fg[1], fg[2]], bgOf(el));
      const big = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
      if (ratio < (big ? 3 : 4.5)) {
        add({ category: "low-contrast", severity: "medium", title: "Low text contrast",
          detail: `Contrast ratio ~${ratio.toFixed(2)}:1 is below the readable minimum.`,
          suggestion: "Darken the text or lighten the background (aim ≥ 4.5:1).", selector: hint(el) });
      }
    }

    // أهداف اللمس الصغيرة
    Array.from(document.querySelectorAll("a[href],button,[role=button],input[type=submit]"))
      .filter(visible)
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) {
          add({ category: "small-tap-target", severity: "medium", title: "Tap target too small",
            detail: `An interactive element is ${Math.round(r.width)}×${Math.round(r.height)}px.`,
            suggestion: "Make clickable controls at least 24×24px (44px on touch).", selector: hint(el) });
        }
      });

    // صور مكسورة
    Array.from(document.querySelectorAll("img")).forEach((img) => {
      if (img.complete && img.naturalWidth === 0) {
        add({ category: "broken-image", severity: "medium", title: "Broken image",
          detail: `Image failed to load: ${img.getAttribute("src") || "(no src)"}.`,
          suggestion: "Fix the image URL or remove the broken <img>.", selector: hint(img) });
      }
    });

    // تجاوز أفقي يكسر التخطيط
    const de = document.documentElement;
    if (de.scrollWidth > window.innerWidth + 2) {
      add({ category: "horizontal-overflow", severity: "medium", title: "Page overflows horizontally",
        detail: `Content width ${de.scrollWidth}px exceeds the viewport ${window.innerWidth}px (sideways scroll).`,
        suggestion: "Constrain wide elements (images/tables/grids) so the layout doesn't break." });
    }

    // فوضى الهوية البصرية
    if (fonts.size > 4) add({ category: "too-many-fonts", severity: "low", title: "Too many font families",
      detail: `${fonts.size} distinct font families on one page.`,
      suggestion: "Limit to 1–2 font families for a consistent, polished look." });
    if (sizes.size > 12) add({ category: "too-many-font-sizes", severity: "low", title: "Inconsistent type scale",
      detail: `${sizes.size} distinct font sizes on one page.`,
      suggestion: "Adopt a small type scale (e.g. 6–8 sizes) for visual rhythm." });
    if (colors.size > 12) add({ category: "too-many-text-colors", severity: "low", title: "Inconsistent color palette",
      detail: `${colors.size} distinct text colors on one page.`,
      suggestion: "Use a defined palette (tokens) instead of many ad-hoc colors." });

    if (!document.querySelector('link[rel~="icon"], link[rel="shortcut icon"]')) {
      add({ category: "no-favicon", severity: "low", title: "No favicon",
        detail: "No <link rel=icon> — the tab shows a blank/default icon.",
        suggestion: "Add a favicon for a finished, branded feel." });
    }

    for (const [cat, n] of Object.entries(counts)) {
      if (n > PER) out.push({ domain: "ui", category: `${cat}-more`, severity: "low",
        title: "More of the same", detail: `${n - PER} more "${cat}" instance(s).`,
        suggestion: "Fix the pattern site-wide, not just the listed cases." });
    }
    return out;
  });
}

/** فحص التجاوز الأفقي عند مقاس معيّن — يُستعمل في سيناريو الاستجابة. */
export async function checkHorizontalOverflow(page: Page, label: string): Promise<RawUxFinding[]> {
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return { scroll: de.scrollWidth, inner: window.innerWidth };
  });
  if (overflow.scroll > overflow.inner + 2) {
    return [{ domain: "responsive", category: "responsive-overflow", severity: "medium",
      title: `Layout breaks at ${label}`,
      detail: `At ${label} the content (${overflow.scroll}px) is wider than the screen (${overflow.inner}px).`,
      suggestion: "Make the layout responsive (flex/grid wrap, max-width:100%, no fixed widths)." }];
  }
  return [];
}

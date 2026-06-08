import type { Page } from "playwright";
import type { RawUxFinding } from "./uxHeuristics.js";

/**
 * تدقيق تحسين محركات البحث والميتا (SEO) لكل صفحة — صاحب المنتج يهتمّ بظهور
 * تطبيقه: عنوان مناسب الطول، وصف ميتا، رابط canonical، وسوم OpenGraph للمشاركة،
 * منع noindex غير المقصود، وتسلسل عناوين سليم. حتمي بالكامل.
 */
export async function auditSeo(page: Page): Promise<RawUxFinding[]> {
  return page.evaluate(() => {
    const out: RawUxFinding[] = [];
    const add = (f: Omit<RawUxFinding, "domain">): void => {
      out.push({ ...f, domain: "seo" });
    };
    const meta = (sel: string): string =>
      (document.querySelector(sel) as HTMLMetaElement | null)?.content?.trim() || "";

    const title = (document.title || "").trim();
    if (!title) {
      add({ category: "seo-no-title", severity: "medium", title: "Missing <title>",
        detail: "The page has no title tag.", suggestion: "Add a unique, descriptive <title> (~50–60 chars)." });
    } else if (title.length < 10) {
      add({ category: "seo-short-title", severity: "low", title: "Title is very short",
        detail: `Title is only ${title.length} characters.`, suggestion: "Use a fuller, descriptive title (~50–60 chars)." });
    } else if (title.length > 65) {
      add({ category: "seo-long-title", severity: "low", title: "Title may be truncated",
        detail: `Title is ${title.length} characters; search engines cut ~60.`, suggestion: "Tighten the title to ~60 characters." });
    }

    const desc = meta('meta[name="description"]');
    if (!desc) {
      add({ category: "seo-no-description", severity: "medium", title: "No meta description",
        detail: "No <meta name=description>.", suggestion: "Add a 50–160 char description summarizing the page." });
    } else if (desc.length < 50 || desc.length > 170) {
      add({ category: "seo-description-length", severity: "low", title: "Meta description length",
        detail: `Description is ${desc.length} chars (ideal 50–160).`, suggestion: "Aim for a 50–160 character description." });
    }

    if (!document.querySelector('link[rel="canonical"]')) {
      add({ category: "seo-no-canonical", severity: "low", title: "No canonical URL",
        detail: "No <link rel=canonical>.", suggestion: "Add canonical to avoid duplicate-content ambiguity." });
    }
    if (!meta('meta[property="og:title"]') || !meta('meta[property="og:image"]')) {
      add({ category: "seo-no-opengraph", severity: "low", title: "Missing OpenGraph tags",
        detail: "No og:title / og:image — links share without a rich preview.",
        suggestion: "Add OpenGraph tags so shared links show a title and image." });
    }
    const robots = meta('meta[name="robots"]').toLowerCase();
    if (robots.includes("noindex")) {
      add({ category: "seo-noindex", severity: "medium", title: "Page is set to noindex",
        detail: "A robots meta marks this page noindex — it won't appear in search.",
        suggestion: "Remove noindex if this page should be discoverable." });
    }
    if (!document.documentElement.getAttribute("lang")) {
      add({ category: "seo-no-lang", severity: "low", title: "No <html lang>",
        detail: "Missing lang attribute.", suggestion: 'Set <html lang="…"> for search and a11y.' });
    }
    return out;
  });
}

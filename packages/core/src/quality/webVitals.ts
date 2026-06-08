import type { Page } from "playwright";
import type { RawUxFinding } from "./uxHeuristics.js";

/**
 * قياس أداء الصفحة وCore Web Vitals — يلتقط LCP (أكبر عنصر) وCLS (إزاحة التخطيط)
 * وTBT (المهام الطويلة) وFCP، إضافةً لوزن الصفحة وعدد الطلبات، ويقارنها بميزانيات
 * معقولة. يجيب «الصفحة بطيئة/ثقيلة/تقفز أثناء التحميل».
 */
export async function auditWebVitals(page: Page): Promise<RawUxFinding[]> {
  // مهلة قصيرة كي تستقرّ مقاييس LCP/CLS بعد التحميل
  await page.waitForTimeout(600).catch(() => undefined);
  const m = await page.evaluate(() => {
    const entries = (type: string): PerformanceEntry[] => {
      try {
        return performance.getEntriesByType(type);
      } catch {
        return [];
      }
    };
    const lcpList = entries("largest-contentful-paint");
    const lcp = lcpList.length ? Math.round(lcpList[lcpList.length - 1]!.startTime) : 0;
    const fcpEntry = entries("paint").find((e) => e.name === "first-contentful-paint");
    const fcp = fcpEntry ? Math.round(fcpEntry.startTime) : 0;
    let cls = 0;
    for (const e of entries("layout-shift") as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
      if (!e.hadRecentInput) cls += e.value;
    }
    let tbt = 0;
    for (const e of entries("longtask")) tbt += Math.max(0, e.duration - 50);
    const resources = entries("resource") as PerformanceResourceTiming[];
    let weight = 0;
    for (const r of resources) weight += r.transferSize || 0;
    const nav = entries("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) weight += nav.transferSize || 0;
    return { lcp, fcp, cls: Math.round(cls * 1000) / 1000, tbt: Math.round(tbt), weight, requests: resources.length };
  });

  const out: RawUxFinding[] = [];
  const f = (category: string, severity: "low" | "medium", title: string, detail: string, suggestion: string): void => {
    out.push({ domain: "performance", category, severity, title, detail, suggestion });
  };

  if (m.lcp > 2500) {
    f("perf-lcp", m.lcp > 4000 ? "medium" : "low", "Slow Largest Contentful Paint",
      `LCP ≈ ${(m.lcp / 1000).toFixed(2)}s (target ≤ 2.5s).`,
      "Optimize the largest element: compress images, preload, reduce blocking JS/CSS.");
  }
  if (m.cls > 0.1) {
    f("perf-cls", m.cls > 0.25 ? "medium" : "low", "Layout shifts during load",
      `CLS ≈ ${m.cls} (target ≤ 0.1).`,
      "Reserve space for images/ads/fonts so content doesn't jump.");
  }
  if (m.tbt > 300) {
    f("perf-tbt", "low", "Long main-thread blocking",
      `Total Blocking Time ≈ ${m.tbt}ms (target ≤ 300ms).`,
      "Split long JS tasks / defer non-critical scripts to keep the page responsive.");
  }
  if (m.weight > 3_000_000) {
    f("perf-weight", "low", "Heavy page payload",
      `Transferred ≈ ${(m.weight / 1_000_000).toFixed(1)}MB across ${m.requests} requests.`,
      "Compress and lazy-load images, code-split JS, and cache static assets.");
  }
  if (m.requests > 120) {
    f("perf-requests", "low", "Many network requests",
      `${m.requests} requests on one page.`,
      "Bundle/inline small assets and use HTTP caching to cut request count.");
  }
  return out;
}

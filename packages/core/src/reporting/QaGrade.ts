import type { QaReport } from "./types.js";

/**
 * حساب درجة جودة كلية وحُكم تنفيذي للتقرير — كي يقرأ كصاحب القرار «ما حالة
 * تطبيقي؟» بنظرة واحدة. حتمي بالكامل: ينطلق من ١٠٠ ويخصم حسب خطورة الإخفاقات
 * والنتائج الأمنية وملاحظات المراجعة الشاملة.
 */
export interface QaGrade {
  score: number;
  grade: string;
  verdict: string;
  failed: number;
  security: number;
  important: number;
  advisories: number;
}

const W: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function gradeReport(report: QaReport): QaGrade {
  let score = 100;

  // إخفاقات السيناريوهات (مرجّحة بالخطورة)
  let failed = 0;
  for (const s of report.scenarios) {
    if (s.status !== "failed") continue;
    failed++;
    score -= [0, 4, 8, 14, 22][W[s.severity] ?? 2]!;
  }

  // النتائج الأمنية
  const security = report.securityFindings.length;
  for (const f of report.securityFindings) score -= [0, 3, 7, 9, 14][W[f.severity] ?? 2]!;

  // ملاحظات المراجعة الشاملة (مسقوفة كي لا تُسقِط الدرجة وحدها)
  const ux = report.scenarios.flatMap((s) => s.uxFindings).filter((f) => !f.category.endsWith("-more"));
  const important = ux.filter((f) => (W[f.severity] ?? 1) >= 3).length;
  const advisories = ux.length - important;
  const uxPenalty = Math.min(28, important * 3 + advisories * 0.4);
  score -= uxPenalty;

  score = Math.max(0, Math.round(score));
  const grade =
    score >= 95 ? "A+" : score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  const verdict =
    grade === "A+" || grade === "A"
      ? "Production-ready — only minor polish remains."
      : grade === "B"
        ? "Solid, with a handful of issues worth fixing before release."
        : grade === "C"
          ? "Functional but needs attention across several areas."
          : grade === "D"
            ? "Notable gaps — address security and broken flows before shipping."
            : "Significant problems found — not ready for release.";

  return { score, grade, verdict, failed, security, important, advisories };
}

import type { BrowserContext, Page } from "playwright";
import type { ScenarioReporter } from "@hasan-qa-humans/core";

/**
 * مرجع متغيّر للمُبلِّغ النشط — يتيح للمراقبات أن تكتب لتقرير السيناريو الحالي
 * حتى مع إعادة استخدام نفس الصفحة عبر عدة سيناريوهات.
 */
export interface ReporterRef {
  current: ScenarioReporter | null;
}

/** Holds the live Playwright surfaces + bookkeeping for a single role. */
export class BrowserRoleContext {
  tracing = false;
  /** صار true إذا فشل سيناريو استعمل هذا السياق (لحفظ الفيديو عند الإغلاق). */
  sawFailure = false;
  /**
   * هل هذا الدور مُصادَق عليه فعلاً؟ يبدأ من وجود جلسة محفوظة، ويصير true بعد أول
   * تسجيل دخول ناجح — كي لا يُعيد الرنر تسجيل الدخول في كل سيناريو عند إعادة
   * استخدام السياق.
   */
  authenticated: boolean;
  /** المُبلِّغ النشط الذي تكتب له المراقبات (يُحدَّث كل سيناريو). */
  readonly reporterRef: ReporterRef = { current: null };

  constructor(
    readonly role: string,
    readonly context: BrowserContext,
    readonly page: Page,
    readonly hasStorageState: boolean,
  ) {
    this.authenticated = hasStorageState;
  }
}

# ADR 0004 — CI/CD، سلامة المحتوى وRTL، الأداء، والأمان الأمامي

التاريخ: ٢٠٢٦-٠٦-٠٨
الحالة: مقبول ومطبّق

## السياق
لاكتمال المنصّة كأداة إنتاج: تكامل مع خطوط الدمج، وفحوص يفتقدها أي مختبِر —
نصوص مكسورة معروضة، اتجاه RTL للعربية، Core Web Vitals، وأمان أمامي أعمق.

## القرار
أربع إضافات، كلها حتمية وتعمل بلا مفتاح:
- **CI/CD**: مُصيّر `JUnitReporter` + خيار `--ci` (headless + كتابة junit.xml +
  تعليقات GitHub `::error/::warning/::notice` + رمز خروج ١ عند الفشل) +
  `--report junit`.
- **سلامة المحتوى وRTL** (`contentSanity` → `content.sanity`): يرصد
  undefined/null/NaN/[object Object]/Invalid Date/قوالب غير مُستبدلة/lorem ipsum،
  ونصّاً عربياً يُعرض باتجاه LTR.
- **الأداء وCore Web Vitals** (`webVitals` → `perf.vitals`): LCP/CLS/TBT ووزن
  الصفحة وعدد الطلبات مقابل ميزانيات.
- **الأمان الأمامي** (`securityHeuristics` → `security.frontend`): محتوى مختلط،
  target=_blank بلا noopener، نماذج POST بلا CSRF، كلمات مرور بلا autocomplete.

## النتائج
- ٢٦ سيناريو مدمجاً، تغطية ١١ طبقة ملاحظات إجمالاً.
- مُتحقَّق حياً: المحتوى رصد كل التوكنات المكسورة + RTL؛ الأمان رصد tabnabbing/
  CSRF/password؛ وضع CI أنتج junit.xml صحيحاً وطبع `::error` وأرجع رمز خروج ١.
- اختبار وحدة لـ JUnit مضاف (المجموع ٤٤ اختباراً).

## الملفات الرئيسة
`packages/core/src/quality/{contentSanity,webVitals,securityHeuristics}.ts`
`packages/core/src/reporting/JUnitReporter.ts`
`packages/scenario-library/src/review/{contentSanity,perfVitals,frontendSecurity}.ts`
`apps/cli/src/commands/run.ts` (وضع --ci والتعليقات), `apps/cli/src/index.ts`

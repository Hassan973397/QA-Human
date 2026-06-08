# ADR 0005 — تسجيل دخول احترافي + إصلاح تحميل الإعداد

التاريخ: ٢٠٢٦-٠٦-٠٨
الحالة: مقبول ومطبّق

## السياق
طُلب أن «تسجّل الأداة الدخول وتختبر كل شيء بشكل كامل وصحيح». كان تسجيل الدخول
هشّاً (يكشف النجاح فقط بمغادرة رابط الدخول)، والأخطر: اكتُشف أن ملفات الإعداد
لم تكن تُطبَّق أصلاً.

## الجذر المكتشَف
‏`tsImport` (tsx) يغلّف التصدير الافتراضي **مرتين**: `mod.default.default` هو
الإعداد الفعلي. الدالة `extractDefault` كانت تأخذ `mod.default` (غلاف)، فتضيع كل
حقول الإعداد وتُطبَّق افتراضيات المخطّط — أي أن `roles` و`routes` و`scenarios`
في qa.config.ts **لم تُقرأ قط**، ولهذا لم تعمل بيانات الاعتماد ولا تسجيل الدخول.

## القرار
- إصلاح `extractDefault`: يفكّ الغلاف حتى يصل لكائن يحمل توقيع إعداد
  (app/roles/routes/...). + اختبارات انحدار.
- تقوية `performLogin`: حقل email أو username، إغلاق overlay، إرسال بزر أو Enter،
  كشف نجاح متعدّد الإشارات (مغادرة الرابط / زر خروج / توكن جلسة / اختفاء النموذج)،
  كشف رسالة الخطأ وإرجاعها حرفياً، وإعادة محاولة واحدة.
- إعداد `auth` اختياري (successUrl/successSelector/errorSelector/submitViaEnter/
  retries) + محدّدات افتراضية (usernameInput/logoutButton/loginError).
- لقطة شاشة لنتيجة الدخول، وسيناريو auth.login يتنقّل لوجهة محمية للتأكيد.

## النتائج
- مُتحقَّق حياً على تطبيق بجلسة كوكي حقيقية: admin سجّل دخوله، حُفظت الجلسة
  (`qa/.auth/admin.json`: `session=ok`) وأُعيد استخدامها، والمناطق المحمية تُحجب
  عن غير المصرّح. ببيانات خاطئة: فشل واضح برسالة التطبيق «Invalid email or password».
- ‏`.env.qa` صار يُحمّل بيانات الاعتماد فعلياً (كان معطّلاً بسبب نفس الجذر).

## الملفات الرئيسة
`packages/core/src/config/loadQaConfig.ts` (extractDefault)
`packages/core/src/runner/StepRunner.ts` (performLogin + كشف النتيجة)
`packages/core/src/human/HumanAgent.ts` (fillIfExists/dismissOverlays/submitLogin)
`packages/core/src/config/schema.ts` + `defaults.ts` (auth + محدّدات)

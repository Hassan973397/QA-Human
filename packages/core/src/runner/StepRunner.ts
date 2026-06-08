import type { QaConfig } from "../config/schema.js";
import type { HumanAgent } from "../human/HumanAgent.js";

export interface LoginResult {
  ok: boolean;
  reason?: string;
  /** الإشارة التي أكّدت النجاح (للتشخيص). */
  signal?: string;
  /** رسالة خطأ الدخول إن ظهرت في الصفحة. */
  errorMessage?: string;
}

/**
 * تسجيل دخول احترافي لدور عبر المحدّدات والمسارات المُعدّة. يتعامل مع:
 * - حقول email أو username (احتياط).
 * - إرسال بزر أو بمفتاح Enter.
 * - طبقات الموافقة/الكوكيز التي تحجب النموذج.
 * - كشف نجاح متعدّد الإشارات (مغادرة الرابط / زر خروج / توكن جلسة / اختفاء النموذج).
 * - كشف رسالة خطأ الدخول وإرجاعها بوضوح.
 * - إعادة محاولة عند فشل عابر (config.auth.retries).
 * يُرجع ok=false (لا يرمي) كي يقرّر المستدعي: تجاوز أم فشل.
 */
export async function performLogin(human: HumanAgent, role: string, config: QaConfig): Promise<LoginResult> {
  const creds = config.roles[role];
  if (!creds?.email || !creds?.password) {
    return { ok: false, reason: `No credentials configured for role "${role}".` };
  }
  const auth = config.auth ?? {};
  const attempts = Math.max(1, (auth.retries ?? 1) + 1);

  let last: LoginResult = { ok: false, reason: `Login for "${role}" not attempted.` };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    last = await attemptLogin(human, role, config, creds.email, creds.password);
    if (last.ok || last.errorMessage) break; // نجاح، أو خطأ صريح لا يفيد تكراره
  }
  return last;
}

async function attemptLogin(
  human: HumanAgent,
  role: string,
  config: QaConfig,
  email: string,
  password: string,
): Promise<LoginResult> {
  const auth = config.auth ?? {};
  try {
    await human.open("login");
    await human.dismissOverlays();

    const filledUser =
      (await human.fillIfExists("emailInput", email)) || (await human.fillIfExists("usernameInput", email));
    if (!filledUser) {
      return { ok: false, reason: `Login for "${role}": no email/username field found (check selectors).` };
    }
    const filledPass = await human.fillIfExists("passwordInput", password);
    if (!filledPass) {
      return { ok: false, reason: `Login for "${role}": no password field found (check selectors).` };
    }
    await human.submitLogin(auth.submitViaEnter ?? false);
    await human.waitForStablePage();
  } catch (error) {
    return { ok: false, reason: `Login flow failed for "${role}": ${(error as Error).message}` };
  }

  const outcome = await detectLoginOutcome(human, config);
  await human.screenshot(`login-${role}-${outcome.success ? "ok" : "fail"}`).catch(() => undefined);

  if (outcome.errorMessage) {
    return { ok: false, reason: `Login error for "${role}": ${outcome.errorMessage}`, errorMessage: outcome.errorMessage };
  }
  if (!outcome.success) {
    return {
      ok: false,
      reason: `Login for "${role}" not confirmed — still on login page and no session/logout detected (check credentials).`,
    };
  }
  return { ok: true, signal: outcome.signal };
}

interface LoginOutcome {
  success: boolean;
  signal?: string;
  errorMessage?: string;
}

/**
 * يكشف نتيجة الدخول بإشارات متعددة — يعمل حتى مع تطبيقات SPA التي لا تغيّر الرابط.
 * تلميحات الإعداد الصريحة (auth.*) تُقدَّم على الكشف التلقائي.
 */
async function detectLoginOutcome(human: HumanAgent, config: QaConfig): Promise<LoginOutcome> {
  const page = human.page;
  const auth = config.auth ?? {};
  const loginRoute = config.routes.login ?? "/login";
  const url = page.url();

  // ١) رسالة خطأ صريحة (محدّد مُعدّ أو محدّدات افتراضية) → فشل واضح
  const errorMessage = await detectError(page, auth.errorSelector);
  if (errorMessage) return { success: false, errorMessage };

  // ٢) تلميحات النجاح الصريحة
  if (auth.successSelector) {
    const visible = await page.locator(auth.successSelector).first().isVisible().catch(() => false);
    if (visible) return { success: true, signal: `successSelector ${auth.successSelector}` };
  }
  if (auth.successUrl && url.includes(auth.successUrl)) {
    return { success: true, signal: `url contains "${auth.successUrl}"` };
  }

  // ٣) كشف تلقائي متعدّد الإشارات
  const leftLogin = !(url.includes(loginRoute) || /\/(login|signin|auth)\b/i.test(url));
  const signals = await page.evaluate(() => {
    const txt = (document.body?.innerText || "").toLowerCase();
    const hasLogout =
      /\b(logout|log out|sign out|تسجيل الخروج|خروج)\b/.test(txt) ||
      !!document.querySelector('[data-testid*="logout" i],[href*="logout" i],[class*="logout" i]');
    let hasToken = false;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = (localStorage.key(i) || "").toLowerCase();
        if (/token|jwt|auth|session|access/.test(k) && (localStorage.getItem(k) || "").length > 8) {
          hasToken = true;
          break;
        }
      }
    } catch {
      /* storage may be blocked */
    }
    if (!hasToken) hasToken = /(token|session|auth|sid|jwt)=[^;]{8,}/i.test(document.cookie || "");
    const formGone = !document.querySelector('input[type="password"]');
    return { hasLogout, hasToken, formGone };
  });

  if (leftLogin) return { success: true, signal: "left the login route" };
  if (signals.hasLogout) return { success: true, signal: "a logout control is present" };
  if (signals.hasToken) return { success: true, signal: "an auth token/session cookie is present" };
  if (signals.formGone) return { success: true, signal: "the login form was removed" };
  return { success: false };
}

/** يقرأ نصّ رسالة خطأ مرئية من محدّد مُعدّ أو من محدّدات افتراضية. */
async function detectError(
  page: HumanAgent["page"],
  errorSelector?: string,
): Promise<string> {
  const selectors = errorSelector
    ? [errorSelector]
    : ['[data-testid="login-error"]', '[role="alert"]', ".error", ".alert-danger", ".invalid-feedback"];
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (!(await loc.isVisible().catch(() => false))) continue;
      const t = ((await loc.innerText().catch(() => "")) || "").trim();
      if (t && /(invalid|incorrect|wrong|failed|denied|error|غير صحيح|خطأ|فشل|بيانات غير)/i.test(t)) {
        return t.slice(0, 160);
      }
    } catch {
      /* ignore and try next */
    }
  }
  return "";
}

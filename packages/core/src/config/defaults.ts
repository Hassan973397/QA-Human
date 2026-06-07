import type { QaConfigInput } from "./schema.js";

/**
 * Sensible default selector hints. These are merged under user selectors so the
 * tool can find common elements even before discovery contributes hints.
 */
export const defaultSelectorHints: Record<string, string[]> = {
  emailInput: [
    '[data-testid="login-email-input"]',
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
  ],
  passwordInput: [
    '[data-testid="login-password-input"]',
    'input[type="password"]',
    'input[name="password"]',
  ],
  loginButton: [
    '[data-testid="login-submit-button"]',
    'button[type="submit"]',
    'button:has-text("تسجيل الدخول")',
    'button:has-text("Login")',
    'button:has-text("Sign in")',
  ],
  searchInput: ['[type="search"]', 'input[name="search"]', 'input[placeholder*="search" i]'],
  addToCartButton: [
    '[data-testid="add-to-cart"]',
    'button:has-text("Add to cart")',
    'button:has-text("أضف إلى السلة")',
    'button:has-text("إضافة للسلة")',
  ],
  checkoutButton: [
    '[data-testid="checkout"]',
    'button:has-text("Checkout")',
    'button:has-text("إتمام الطلب")',
    'button:has-text("الدفع")',
  ],
};

export const defaultRoutes: Record<string, string> = {
  login: "/login",
  dashboard: "/dashboard",
};

/**
 * The baseline config object. User config is deep-merged on top of this before
 * Zod validation runs, so omitted sections still get reasonable values.
 */
export const baseConfig: QaConfigInput = {
  app: { name: "My App", baseUrl: "http://localhost:3000", type: "unknown" },
  discovery: { enabled: true, projectRoot: process.cwd() },
  browser: {},
  roles: {},
  routes: defaultRoutes,
  selectors: defaultSelectorHints,
  scenarios: [],
  safety: {},
};

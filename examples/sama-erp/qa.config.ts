import { defineQaConfig } from "@hasan-qa-humans/core";

/**
 * Example configuration for a SAMA-ERP-style multi-tenant commerce/ERP app.
 * Adjust routes/selectors/roles to match your real application, then fill in
 * test credentials in .env.qa (never commit it).
 */
export default defineQaConfig({
  app: {
    name: "SAMA ERP",
    baseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
    type: "erp",
  },
  discovery: {
    enabled: true,
    projectRoot: process.cwd(),
    include: ["src/**/*", "app/**/*", "pages/**/*", "modules/**/*", "apps/**/*", "packages/**/*"],
  },
  browser: {
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  roles: {
    customer: { email: process.env.QA_CUSTOMER_EMAIL, password: process.env.QA_CUSTOMER_PASSWORD },
    merchant: { email: process.env.QA_MERCHANT_EMAIL, password: process.env.QA_MERCHANT_PASSWORD, tenant: "A" },
    merchantB: { email: process.env.QA_MERCHANT_B_EMAIL, password: process.env.QA_MERCHANT_B_PASSWORD, tenant: "B" },
    agent: { email: process.env.QA_AGENT_EMAIL, password: process.env.QA_AGENT_PASSWORD },
    employee: { email: process.env.QA_EMPLOYEE_EMAIL, password: process.env.QA_EMPLOYEE_PASSWORD },
    admin: { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD },
  },
  routes: {
    login: "/login",
    dashboard: "/dashboard",
    store: "/store",
    cart: "/cart",
    checkout: "/checkout",
    orders: "/orders",
    merchantOrders: "/dashboard/orders",
    customers: "/dashboard/customers",
    products: "/dashboard/products",
    admin: "/admin",
  },
  selectors: {
    emailInput: ['[data-testid="login-email-input"]', 'input[type="email"]', 'input[name="email"]'],
    passwordInput: ['[data-testid="login-password-input"]', 'input[type="password"]'],
    loginButton: ['[data-testid="login-submit-button"]', 'button[type="submit"]'],
    addToCartButton: ['[data-testid="add-to-cart"]', 'button:has-text("Add to cart")'],
    checkoutButton: ['[data-testid="checkout"]', 'button:has-text("Checkout")'],
  },
  scenarios: [
    "auth.login",
    "smoke.pages",
    "ecommerce.customerCreateOrder",
    "ecommerce.merchantManageOrder",
    "ecommerce.merchantBlockCustomer",
    "security.rolePermissions",
    "security.tenantIsolation",
  ],
  safety: {
    testDataPrefix: "AUTO_HQA",
    allowDeleteOnlyWithPrefix: true,
    blockProductionBaseUrls: true,
    productionUrlPatterns: ["://sama.", "://www.", "://app.", "production", "prod."],
  },
});

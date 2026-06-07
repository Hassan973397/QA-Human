import path from "node:path";
import { ensureDir, writeText, pathExists, logger, pc } from "@hasan-qa-humans/core";
import { getProjectRoot, getQaDir, getScenariosDir } from "../lib.js";

const QA_CONFIG = `import { defineQaConfig } from "@hasan-qa-humans/core";

export default defineQaConfig({
  app: {
    name: "My App",
    baseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
    type: "unknown",
  },
  discovery: {
    enabled: true,
    projectRoot: process.cwd(),
  },
  browser: {
    headless: true,
    slowMo: 0,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  roles: {
    customer: { email: process.env.QA_CUSTOMER_EMAIL, password: process.env.QA_CUSTOMER_PASSWORD, required: false },
    merchant: { email: process.env.QA_MERCHANT_EMAIL, password: process.env.QA_MERCHANT_PASSWORD, required: false },
    merchantB: { email: process.env.QA_MERCHANT_B_EMAIL, password: process.env.QA_MERCHANT_B_PASSWORD, required: false },
    agent: { email: process.env.QA_AGENT_EMAIL, password: process.env.QA_AGENT_PASSWORD, required: false },
    employee: { email: process.env.QA_EMPLOYEE_EMAIL, password: process.env.QA_EMPLOYEE_PASSWORD, required: false },
    admin: { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD, required: false },
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
    passwordInput: ['[data-testid="login-password-input"]', 'input[type="password"]', 'input[name="password"]'],
    loginButton: ['[data-testid="login-submit-button"]', 'button[type="submit"]'],
  },
  scenarios: [
    "auth.login",
    "smoke.pages",
    "ecommerce.customerCreateOrder",
    "security.rolePermissions",
    "security.tenantIsolation",
  ],
  safety: {
    testDataPrefix: "AUTO_HQA",
    allowDeleteOnlyWithPrefix: true,
    blockProductionBaseUrls: true,
  },
});
`;

const ENV_EXAMPLE = `# Copy to .env.qa and fill in test/staging credentials. NEVER commit .env.qa.
APP_BASE_URL=http://localhost:3000

QA_CUSTOMER_EMAIL=
QA_CUSTOMER_PASSWORD=

QA_MERCHANT_EMAIL=
QA_MERCHANT_PASSWORD=

QA_MERCHANT_B_EMAIL=
QA_MERCHANT_B_PASSWORD=

QA_AGENT_EMAIL=
QA_AGENT_PASSWORD=

QA_EMPLOYEE_EMAIL=
QA_EMPLOYEE_PASSWORD=

QA_ADMIN_EMAIL=
QA_ADMIN_PASSWORD=
`;

const QA_GITIGNORE = `# Hasan QA Humans runtime artifacts
.hqa/
.auth/
reports/
`;

const QA_README = `# QA — Hasan QA Humans

This folder holds your QA setup.

- \`scenarios/\` — your custom \`*.scenario.ts\` files.
- \`.hqa/\` — generated discovery artifacts (gitignored).
- \`.auth/\` — saved login sessions per role (gitignored).
- \`reports/\` — generated reports (gitignored).

## Quick start

1. \`cp .env.qa.example .env.qa\` and fill in test credentials.
2. \`hqa doctor\`   — verify your setup.
3. \`hqa discover\` — study the project.
4. \`hqa generate\` — scaffold scenarios from discovery.
5. \`hqa run\`      — run the human QA scenarios.
6. \`hqa report\`   — view the latest report.
`;

interface InitOptions {
  cwd?: string;
  force?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const root = getProjectRoot(options);
  const qaDir = getQaDir(root);

  const files: Array<{ path: string; content: string }> = [
    { path: path.join(root, "qa.config.ts"), content: QA_CONFIG },
    { path: path.join(root, ".env.qa.example"), content: ENV_EXAMPLE },
    { path: path.join(qaDir, ".gitignore"), content: QA_GITIGNORE },
    { path: path.join(qaDir, "README.md"), content: QA_README },
  ];

  await ensureDir(getScenariosDir(root));
  await ensureDir(path.join(qaDir, "reports"));

  let created = 0;
  let skipped = 0;
  for (const file of files) {
    if (!options.force && (await pathExists(file.path))) {
      logger.raw(`  ${pc.yellow("skip")} ${path.relative(root, file.path)} (exists)`);
      skipped++;
      continue;
    }
    await writeText(file.path, file.content);
    logger.raw(`  ${pc.green("create")} ${path.relative(root, file.path)}`);
    created++;
  }

  logger.success(`init complete — ${created} created, ${skipped} skipped.`);
  logger.info("Next: cp .env.qa.example .env.qa, then run `hqa doctor`.");
}

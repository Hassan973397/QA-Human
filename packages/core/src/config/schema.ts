import { z } from "zod";

export const appTypeSchema = z.enum([
  "unknown",
  "ecommerce",
  "saas",
  "erp",
  "dashboard",
  "marketing",
]);

export const roleConfigSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
  /** Whether a scenario requiring this role should fail (true) or skip (false) when missing. */
  required: z.boolean().default(false),
  /** Optional tenant identifier, used by tenant-isolation scenarios. */
  tenant: z.string().optional(),
});

export const browserConfigSchema = z.object({
  headless: z.boolean().default(true),
  slowMo: z.number().min(0).default(0),
  /** Which Playwright browser engine to drive. */
  engine: z.enum(["chromium", "firefox", "webkit"]).default("chromium"),
  trace: z
    .enum(["on", "off", "retain-on-failure", "on-first-retry"])
    .default("retain-on-failure"),
  screenshot: z.enum(["on", "off", "only-on-failure"]).default("only-on-failure"),
  video: z.enum(["on", "off", "retain-on-failure"]).default("retain-on-failure"),
  viewport: z
    .object({ width: z.number().default(1440), height: z.number().default(900) })
    .default({ width: 1440, height: 900 }),
  defaultTimeoutMs: z.number().default(15000),
  navigationTimeoutMs: z.number().default(30000),
});

export const discoveryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  projectRoot: z.string().default(process.cwd()),
  include: z
    .array(z.string())
    .default([
      "src/**/*",
      "app/**/*",
      "pages/**/*",
      "routes/**/*",
      "components/**/*",
      "modules/**/*",
      "apps/**/*",
      "packages/**/*",
    ]),
  exclude: z
    .array(z.string())
    .default([
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/qa/**",
    ]),
  maxFiles: z.number().default(6000),
});

export const safetyConfigSchema = z.object({
  testDataPrefix: z.string().default("AUTO_HQA"),
  allowDeleteOnlyWithPrefix: z.boolean().default(true),
  blockProductionBaseUrls: z.boolean().default(true),
  allowDestructiveActions: z.boolean().default(false),
  productionUrlPatterns: z
    .array(z.string())
    .default(["://www.", "://app.", "production", "prod."]),
  allowedHostPatterns: z
    .array(z.string())
    .default(["localhost", "127.0.0.1", "0.0.0.0", "staging", "test", "dev", "qa"]),
});

export const qaConfigSchema = z.object({
  app: z.object({
    name: z.string().default("My App"),
    baseUrl: z.string().default("http://localhost:3000"),
    type: appTypeSchema.default("unknown"),
  }),
  discovery: discoveryConfigSchema.default({}),
  browser: browserConfigSchema.default({}),
  roles: z.record(z.string(), roleConfigSchema).default({}),
  routes: z.record(z.string(), z.string()).default({}),
  selectors: z.record(z.string(), z.array(z.string())).default({}),
  scenarios: z.array(z.string()).default([]),
  /** Extra directory (relative to project root) to load *.scenario.ts from. */
  scenariosDir: z.string().optional(),
  /** Default number of parallel workers for `hqa run`. */
  workers: z.number().int().min(1).max(16).default(1),
  /** Default retry count for failed scenarios (flaky detection). */
  retries: z.number().int().min(0).max(5).default(0),
  /** Page-load budget in ms; navigations slower than this are flagged. 0 = off. */
  performanceBudgetMs: z.number().int().min(0).default(0),
  safety: safetyConfigSchema.default({}),
});

export type AppType = z.infer<typeof appTypeSchema>;
export type RoleConfig = z.infer<typeof roleConfigSchema>;
export type BrowserConfig = z.infer<typeof browserConfigSchema>;
export type DiscoveryConfig = z.infer<typeof discoveryConfigSchema>;
export type SafetyConfig = z.infer<typeof safetyConfigSchema>;
export type QaConfig = z.infer<typeof qaConfigSchema>;

/** The shape users pass to defineQaConfig (everything optional / pre-validation). */
export type QaConfigInput = z.input<typeof qaConfigSchema>;

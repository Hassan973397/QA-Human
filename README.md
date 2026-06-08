# Hasan QA Humans

> A human-like QA engine on top of Playwright. It **studies your app first**, builds an
> App Knowledge Graph, then drives the browser as if a real QA team logged in with
> different roles, clicked around, filled forms, created orders, changed statuses,
> blocked customers, and probed permissions & tenant isolation — producing a full,
> evidence-backed report.

It is **not** "just Playwright tests". The flow is **Discover → Understand → Test → Report**.

---

## Why it's different from plain Playwright

| Plain Playwright | Hasan QA Humans |
| --- | --- |
| You hand-write every selector & flow | It **discovers** routes, forms, roles, APIs, workflows first |
| Tests assume the app's structure | It builds an **App Knowledge Graph** and reasons about it |
| One browser session | **Multi-role** isolated browser contexts (customer, merchant, admin…) |
| Pass/fail | Severity, suspected **root cause**, **recommended fix**, security findings |
| You assert manually | Built-in human assertions: no blank screen, no console/5xx errors, blocked access |
| Missing feature → red test | Missing feature → **skipped/blocked** with a clear reason (no false bugs) |

---

## Install

```bash
# inside this monorepo
pnpm install
pnpm build
npx playwright install chromium    # one-time browser download
```

To use it in another project, install the published packages (or link this repo) and the
`hqa` binary becomes available:

```bash
hqa --help
```

## The 6 commands

```bash
hqa init        # scaffold qa.config.ts, .env.qa.example, qa/ folder
hqa doctor      # check node, browsers, base URL, .env.qa, credentials, config
hqa discover    # study the project → qa/.hqa/*.json + discovery-report.md
hqa generate    # scaffold starter scenarios from discovery features
hqa run         # run the human QA scenarios, produce reports + artifacts
hqa report      # print the latest report summary + file links
```

### `hqa run` options

```
--headed | --headless        visible vs. headless browser
--scenario <id>              only scenarios whose id contains this value
--role <role>                only scenarios that use this role
--slow-mo <ms>               slow actions down
--base-url <url>             override APP_BASE_URL
--browser <engine>           chromium | firefox | webkit
--workers <n>                run scenarios in N parallel workers
--report json|md|html|all    report format (default: all)
--fail-fast                  stop after the first failure
--no-video / --no-trace      disable video/trace capture
--allow-production           permit a production-like base URL (off by default)
--open                       open the HTML report when finished
--verbose                    verbose logging

# report also supports:
hqa report --open            open the HTML report
hqa report --compare         diff the latest run against the previous one
```

## Quick start

```bash
hqa init
cp .env.qa.example .env.qa     # fill TEST/STAGING credentials only
hqa doctor
hqa discover
hqa generate
hqa run
hqa report
```

## What `discover` studies

- **Framework** (Next / React / Vite / Remix / Angular / Vue / Nest / Express, monorepo)
- **Package manager** + scripts (dev/build/test/lint/typecheck/start)
- **Routes** (Next app & pages routers, React Router, API routes)
- **Forms** (login / checkout / order / customer / product / status) + fields
- **Roles** (enums, unions, `hasRole`, guards, comparisons) + permission strings
- **API endpoints** (Express/Nest/Next handlers) with auth + tenant-scope flags
- **Workflows** (login, create order, update status, block customer, delivery, tenant isolation)
- **UI selectors** (`data-testid`, `aria-label`, `name`, `placeholder`)
- **Features**, **risks**, and **unknowns** (anything it could not infer)

Output lands in `qa/.hqa/` (`app-knowledge-graph.json`, `routes.json`, `forms.json`,
`api-map.json`, `roles.json`, `workflows.json`, `discovery-report.md`).

## Built-in scenarios

`auth.login`, `smoke.pages`, `smoke.blankScreen`,
`ecommerce.customerCreateOrder`, `ecommerce.merchantManageOrder`,
`ecommerce.merchantBlockCustomer`, `ecommerce.blockedCustomerCannotOrder`,
`ecommerce.orderLifecycle`, `security.rolePermissions`,
`security.unauthenticatedAccess`, `security.tenantIsolation`, `api.basicHealth`.

Each scenario degrades gracefully: if the required role, route, or feature is missing it
is **skipped/blocked** with a reason instead of producing a false failure.

## How it tests "from A to Z"

1. **Study** — read files, infer routes/forms/roles/APIs/workflows → knowledge graph.
2. **Authenticate** — log each role into its own isolated browser context, saving
   `qa/.auth/<role>.json` so future runs skip the login.
3. **Act like humans** — open pages, click, fill, type, select, create orders, change
   statuses, block customers, attempt cross-role/cross-tenant access.
4. **Observe** — every step waits properly, checks for blank screens, console errors,
   and HTTP 5xx; failures snapshot screenshots, traces, and video.
5. **Report** — JSON + Markdown + HTML with severity, suspected root cause, recommended
   fix, security findings, unknowns, and required configuration.

## Supported everywhere

- **Browsers:** Chromium, Firefox, WebKit (`--browser` or `browser.engine`).
- **Parallelism:** `--workers N` (or `workers` in config) runs scenarios across N
  isolated browsers and merges the reports.
- **Authenticated API checks:** every human can call `apiGet/apiPost/apiRequest` through
  its own logged-in session (cookies included) — used by `api.basicHealth` and isolation checks.
- **Test data safety:** `ctx.testData("order")` → `AUTO_HQA_order`; `ctx.safety` exposes the
  guard (production blocking, delete-prefix, destructive gate).
- **History & comparison:** every run is archived under `qa/reports/<timestamp>/`;
  `hqa report --compare` shows status changes vs the previous run.
- **LLM-ready analysis:** `LlmAiAnalyzer` plugs an LLM provider in behind the `AiAnalyzer`
  interface; with no provider it falls back to the deterministic rule-based analyzer.

## Adding things

- **A role:** add it under `roles` in `qa.config.ts` and provide `QA_<ROLE>_EMAIL/PASSWORD`.
- **A scenario:** drop a `*.scenario.ts` in `qa/scenarios/` (see [docs/scenario-authoring.md](docs/scenario-authoring.md)).
- **Selectors:** add named candidate lists under `selectors` in `qa.config.ts`.
- **Missing credentials:** scenarios needing that role are skipped with a clear reason —
  no failures.

## Running on SAMA ERP (example)

See [`examples/sama-erp`](examples/sama-erp) for a complete `qa.config.ts`, `.env.qa.example`,
and custom scenarios (create order, block customer, blocked-cannot-order, role permissions,
tenant isolation, full order lifecycle).

```bash
cd examples/sama-erp
cp .env.qa.example .env.qa
hqa discover
hqa run
```

## Architecture & docs

- [docs/architecture.md](docs/architecture.md)
- [docs/scenario-authoring.md](docs/scenario-authoring.md)
- [docs/safety.md](docs/safety.md)
- [docs/reporting.md](docs/reporting.md)

## Monorepo layout

```
apps/cli                      # the hqa command-line interface
packages/core                 # config, discovery, knowledge graph, human agents, runner, reporting, safety
packages/playwright-runner    # Playwright BrowserEngine: multi-role contexts, watchers, traces, video
packages/scenario-library     # ready-made scenarios + generation templates
examples/sama-erp             # example QA setup for a multi-tenant ERP/commerce app
```

## Scripts

```bash
pnpm build       # tsc -b across all packages
pnpm typecheck   # type-check
pnpm clean       # remove build outputs
```

## Safety

By default the tool **refuses to run against production-looking URLs**, only deletes data
prefixed with `AUTO_HQA`, and keeps destructive actions disabled unless explicitly enabled
for a known test/staging host. See [docs/safety.md](docs/safety.md).

## License

MIT

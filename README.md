# Hasan QA Humans

[![CI](https://github.com/Hassan973397/QA-Human/actions/workflows/ci.yml/badge.svg)](https://github.com/Hassan973397/QA-Human/actions/workflows/ci.yml)

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

To use it in another project, install the CLI from npm — the `hqa` binary becomes available:

```bash
npm i -g @hasan-qa-humans/cli      # or: pnpm add -D @hasan-qa-humans/cli
hqa --help
```

### Run with Docker (no local browsers needed)

The image is based on the official Playwright image, so all browsers are preinstalled.

```bash
docker build -t hqa .

# Run any command against your mounted project:
docker run --rm -v "$PWD":/work -w /work hqa discover
docker run --rm --network host -v "$PWD":/work -w /work hqa run --base-url http://localhost:3000
```

The entrypoint symlinks the bundled tool into your project so `qa.config.ts` resolves
`@hasan-qa-humans/*` without a local install.

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
--retries <n>                retry failed scenarios N times (flaky detection)
--report json|md|html|all    report format (default: all)
--fail-fast                  stop after the first failure
--no-video / --no-trace      disable video/trace capture
--allow-production           permit a production-like base URL (off by default)
--update-snapshots           record/refresh visual baselines instead of comparing
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

Functional & security: `auth.login`, `smoke.pages`, `smoke.blankScreen`,
`explore.crawl`, `ecommerce.customerCreateOrder`, `ecommerce.merchantManageOrder`,
`ecommerce.merchantBlockCustomer`, `ecommerce.blockedCustomerCannotOrder`,
`ecommerce.orderLifecycle`, `security.rolePermissions`,
`security.unauthenticatedAccess`, `security.tenantIsolation`, `api.basicHealth`,
`visual.pages`, `a11y.audit`.

Comprehensive review (owner's eye, every layer):
`review.productOwner` (UX/structure), `ui.designQuality` (contrast, fonts, broken
images, layout), `ui.responsive` (phone/tablet), `seo.audit` (title/description/
canonical/OpenGraph), `api.security` (security headers, cookies, errors),
`links.integrity` (broken links/assets), `forms.validation` (input validation,
no submission), `audit.static` (secrets, SQL injection, money-as-float, eval, XSS,
exposed `.env` — backend & database at the source level), `content.sanity`
(undefined/NaN/[object Object]/Invalid Date/placeholders + RTL direction),
`perf.vitals` (LCP/CLS/TBT, page weight, request count), `security.frontend`
(mixed content, tabnabbing, CSRF hints, password autocomplete).

Every report opens with an overall **QA score (A+…F)** and an executive verdict,
and groups review findings by layer with a fix suggestion each.

Each scenario degrades gracefully: if the required role, route, or feature is missing it
is **skipped/blocked** with a reason instead of producing a false failure.

## Logging in (authentication)

Give each role credentials in `.env.qa` (`QA_<ROLE>_EMAIL` / `QA_<ROLE>_PASSWORD`)
and the tool logs that role into its own isolated browser context, saving the
session to `qa/.auth/<role>.json` so later runs skip the login. The login flow is
robust: it fills email **or** username, dismisses cookie/consent overlays, submits
by button or Enter, and confirms success by **multiple signals** (left the login
route, a logout control appeared, an auth token/session cookie is present, or the
login form was removed). A visible error message ("invalid credentials" / "بيانات
غير صحيحة") is detected and reported verbatim instead of a vague failure.

By default each role is logged in **once per run** and its browser context is
reused across every scenario — so you see one window per role and a single login,
not a fresh window/login per scenario. Per-scenario traces are still captured (as
tracing chunks); session videos are saved per role at the end. Pass
`--fresh-contexts` (or `browser.reuseContexts: false`) to get the classic
isolated-context-per-scenario behavior with independent per-scenario video.

For non-standard apps, add an optional `auth` block to `qa.config.ts`:

```ts
auth: {
  successUrl: "/dashboard",          // URL fragment that means "logged in"
  successSelector: '[data-testid=user-menu]',
  errorSelector: '.login-error',
  submitViaEnter: false,             // submit with Enter instead of a button
  retries: 1,                        // retry a transient login once
}
```

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

## Performance & reliability upgrades

These are the features that make it punch far above ordinary test runners:

- **Cached discovery.** A file-signature (path+size+mtime) cache means re-running
  `discover`/`run` skips the whole scan when nothing changed — effectively instant on
  large repos. Bypass with `hqa discover --force`.
- **Parallel file scanning.** Discovery reads files with bounded concurrency
  (`cores × 4`), not one-by-one.
- **Auto-healing selectors.** When the primary selector for a logical name fails but a
  fallback matches (selector drift), the run keeps going **and** the report tells you which
  selector worked so you can promote it. Guessed-from-label selectors are flagged too.
- **Per-page performance metrics.** Every navigation captures TTFB / DOMContentLoaded /
  load time; set `performanceBudgetMs` to flag slow pages. Reports include a Performance
  section with the slowest pages.
- **Flaky detection + retries.** `--retries N` re-runs failed scenarios in fresh contexts;
  a later pass marks the scenario **flaky** instead of red.
- **Autonomous crawler.** `hqa run --scenario explore.crawl` explores the app like a human:
  breadth-first across same-origin links (bounded by `HQA_CRAWL_MAX`), smoke-checking every
  page for blank screens and server errors.
- **Visual regression.** `visual.pages` pixel-diffs each page against a stored baseline
  (pixelmatch). First run records baselines; later runs fail on changes beyond
  `visual.maxDiffRatio` and attach a diff image. Refresh with `hqa run --update-snapshots`.
- **Accessibility audits.** `a11y.audit` runs axe-core in-page and fails on violations at or
  above `a11y.failOn` (default `serious`), listing every issue with its help URL.
- **LLM failure analysis (optional).** Set `ANTHROPIC_API_KEY` and failed scenarios are
  enriched with Claude (`claude-opus-4-8`) for root cause + fix; with no key it falls back to
  the deterministic rule-based analyzer. Override the model with `HQA_LLM_MODEL`.

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
pnpm lint        # eslint (flat config)
pnpm test        # node:test unit suite (discovery, config, selectors, safety, reporting, utils)
pnpm clean       # remove build outputs
```

CI runs install → build → typecheck → lint → test on every push and pull request.

### Releasing

The packages publish to npm automatically when a version tag is pushed (requires an
`NPM_TOKEN` repo secret):

```bash
git tag v1.0.0 && git push origin v1.0.0   # triggers .github/workflows/release.yml
```

## CI/CD integration

Run in any pipeline with `--ci`: it forces headless, writes JUnit XML, prints
GitHub Actions annotations for failures/security findings, and exits non-zero when
any scenario fails (so the build breaks on regressions).

```yaml
# .github/workflows/qa.yml
- run: npx hqa run --base-url "$STAGING_URL" --ci
# → qa/reports/latest/junit.xml, ::error annotations, exit 1 on failure
```

`--report junit` writes the JUnit file without full CI mode; `--report all`
includes JSON, Markdown, HTML, and JUnit together.

## Safety

By default the tool **refuses to run against production-looking URLs**, only deletes data
prefixed with `AUTO_HQA`, and keeps destructive actions disabled unless explicitly enabled
for a known test/staging host. See [docs/safety.md](docs/safety.md).

## License

MIT

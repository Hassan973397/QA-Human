# Authoring scenarios

A scenario is a `*.scenario.ts` file in `qa/scenarios/` (or a top-level `scenarios/` dir)
whose default export is created with `scenario({...})`.

```ts
import { scenario } from "@hasan-qa-humans/core";

export default scenario({
  id: "ecommerce.customerCreateOrder",
  title: "Customer creates an order",
  roles: ["customer"],            // roles to acquire + log in before run()
  tags: ["ecommerce", "orders"],
  severity: "critical",           // critical | high | medium | low
  requiresFeatures: ["ordering"], // skip (blocked) if discovery didn't find these
  run: async ({ humans, graph, report, config, sharedMemory, api, skip, requireRole, requireRoute, requireFeature }) => {
    const customer = humans.customer();        // pre-acquired & authenticated
    await customer.open("store");              // route name (config/discovery) or "/path"
    await customer.assertNoBlankScreen();
    const added = await customer.clickIfExists("addToCartButton");
    if (!added) return;                        // unknown UI → not a bug
    await customer.clickIfExists("checkoutButton");
    await customer.clickIfExists('button[type="submit"]');
    await customer.assertNoServerErrors();
  },
});
```

## The `ScenarioContext`

- `humans` — accessor: `humans.customer()`, `humans.merchant()`, `humans.guest()`,
  `humans.get(role)`, `humans.has(role)`.
- `graph` — the `AppKnowledgeGraph` (routes, roles, features, apiEndpoints…).
- `report` — the per-scenario reporter (steps are added automatically by human actions).
- `config` — the validated `qa.config`.
- `sharedMemory` — `Map` shared across humans/scenarios (e.g. an orderId).
- `api` — unauthenticated fetch client scoped to `app.baseUrl` (`api.get/post/request`).
- `safety` — the `SafetyGuard` (production checks, delete prefix, destructive gate).
- `testData(label)` — prefix a label with the safe test-data prefix (`AUTO_HQA_<label>`).
- `skip(reason)` — abort as **skipped** (not a failure).
- `requireRole(role)` / `requireRoute(route)` / `requireFeature(feature)` — guard helpers
  that skip with a clear reason when a prerequisite is missing.

## HumanAgent API

Navigation: `open(routeNameOrPath)`, `goto(url)`.
Interaction: `click`, `fill`, `fillByLabel`, `selectOption`, `typeLikeHuman`,
`clickIfExists`, `exists`.
Assertions: `expectText`, `expectVisible`, `expectUrl`, `expectBlocked`,
`expectPermissionDenied`, `assertNoBlankScreen`, `assertNoCriticalConsoleErrors`,
`assertNoServerErrors`.
Authenticated API (sends this role's cookies/session): `apiGet`, `apiPost`, `apiRequest`.
Quality: `expectVisualMatch(name)` (pixel baseline diff), `auditAccessibility(scope?)` (axe-core).
Memory/artifacts: `remember`, `recall`, `share`, `screenshot`, `captureState`,
`waitForStablePage`, `pauseForDebug`, and `page` (raw Playwright page escape hatch).

## Selectors

Pass a **named selector** (resolved from `qa.config.selectors` + discovery + defaults), a
**raw locator** (`button[type="submit"]`, `text=Login`, `[data-testid="x"]`), or a plain
label (the resolver synthesizes `data-testid`/`aria-label`/`name`/`placeholder`/`text`
candidates). The first candidate that matches wins.

## Principles

- **Be defensive.** Use `clickIfExists`/`exists` and `requireFeature` so unknown UI becomes
  a skip, not a false bug.
- **Share state across roles** via `human.share(key, value)` + `recall` / `sharedMemory`.
- **Prefer logical route/selector names** so scenarios survive markup changes.

## Generating starters

`hqa generate` writes templates (filtered by discovered features) into `qa/scenarios/`.
Edit them to match your real flows.

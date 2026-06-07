# Architecture

Hasan QA Humans is a pnpm monorepo. The dependency direction is strictly one-way to avoid
cycles: **scenario-library → core**, **playwright-runner → core**, **cli → everything**.

```
                +------------------+
                |   apps/cli       |  commands: init/doctor/discover/generate/run/report
                +------------------+
                  |      |       |
        +---------+      |       +-------------------+
        v                v                           v
+----------------+  +-------------------------+  +---------------------+
| scenario-      |  | playwright-runner       |  | core                |
| library        |  | (BrowserEngine impl)    |  | (everything else)   |
+----------------+  +-------------------------+  +---------------------+
        |                       |                          ^
        +-----------------------+--------------------------+
                         depend on core
```

## Packages

### `@hasan-qa-humans/core`
The brain. No Playwright orchestration lives here — only **types** from Playwright are used.

- **config/** — `defineQaConfig`, Zod `schema`, `loadQaConfig` (deep-merges defaults, validates).
- **discovery/** — `ProjectScanner` reads files once and runs detectors
  (Framework, PackageManager, Route, Role, Api, Form, Component, Permission, Workflow).
- **knowledge/** — `buildKnowledgeGraph` merges config + discovery into the
  `AppKnowledgeGraph`; `KnowledgeStore` persists `qa/.hqa/*`.
- **selectors/** — `SelectorRegistry` + `SelectorResolver` turn logical names
  (e.g. `loginButton`) into the first matching Playwright locator from candidate lists.
- **human/** — `HumanAgent` (open/click/fill/expect…/assertNoBlankScreen…), `HumanMemory`,
  `HumanFactory`. Each action is a reported step that waits, acts, checks, and screenshots
  on failure.
- **runner/** — `QaRunner` (the conductor), `ScenarioRegistry`, `ScenarioContext`,
  `ScenarioLoader`, `StepRunner` (login flow). Talks to the browser only via the
  `BrowserEngine` port.
- **reporting/** — `QaReporter` + Markdown/JSON/HTML renderers + `SeverityClassifier`.
- **safety/** — `SafetyGuard` (production blocking, delete-prefix, destructive gate).
- **ai/** — `RuleBasedAiAnalyzer` behind an `AiAnalyzer` interface (LLM-ready, no API in v1).

### `@hasan-qa-humans/playwright-runner`
Implements the `BrowserEngine` port from core. Owns:
- `BrowserSessionManager` — launches one browser, mints **one isolated context per role**,
  restores `qa/.auth/<role>.json`, configures viewport + video.
- `errorsWatcher` / `networkWatcher` — feed console errors and HTTP 5xx into the reporter.
- `traceManager` / `videoManager` — retain traces & video per policy (e.g. on failure).

### `@hasan-qa-humans/scenario-library`
Ready-made scenarios (ecommerce / security / smoke / auth) plus `scenarioTemplates`
used by `hqa generate`.

### `apps/cli`
Wires everything with Commander, and provides a **tsx-based importer** so users author
`qa.config.ts` and `*.scenario.ts` in TypeScript.

## Key design choices

- **Dependency inversion at the browser boundary.** `QaRunner` (core) depends on the
  `BrowserEngine` interface; the CLI injects the concrete `PlaywrightEngine`. This keeps
  all QA logic testable and Playwright-free in core.
- **Pre-acquire humans.** Before a scenario runs, the runner acquires + logs in every role
  it declares. So `humans.customer()` is synchronous in scenarios, and a missing role
  cleanly turns into a *skip*, not a crash.
- **Discovery is read-only.** The scanner never writes to or mutates the target project.
- **Honest about uncertainty.** Anything not inferred is surfaced as `unknowns` /
  `requiredConfig`; missing features become skipped/blocked scenarios.

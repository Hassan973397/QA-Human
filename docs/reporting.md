# Reporting

After `hqa run`, reports are written to `qa/reports/latest/`:

```
qa/reports/latest/
  report.json        # machine-readable full report
  report.md          # markdown summary
  report.html        # self-contained dark-themed HTML report
  artifacts/
    screenshots/     # <role>-NN-<name>.png (captured on failure + captureState)
    videos/          # <scenarioId>-<role>.webm (per video policy)
    traces/          # <scenarioId>-<role>.zip (open with `npx playwright show-trace`)
```

## What each report contains

- App name, base URL, environment, started-at, duration.
- **Discovery summary** (frameworks, routes, API endpoints, roles, features).
- **Summary counts**: passed / failed / skipped / blocked.
- **Per scenario**: status, severity, roles used, tags, steps, screenshots, video, trace,
  console errors, network errors, failure reason, **suspected root cause**, **recommended
  fix**, skip reason.
- **Security findings**: role-permission and tenant-isolation issues.
- **Unknowns**: things the tool could not infer.
- **Required configuration**: missing credentials / routes / selectors / features.

## Status meanings

- **passed** — the scenario completed its assertions.
- **failed** — an assertion failed or an unexpected error occurred (artifacts captured).
- **skipped** — a prerequisite was missing at runtime (`skip()`, missing role/route).
- **blocked** — a required feature was not detected in discovery (a prerequisite gate).

## Severity classification (rule-based)

`SeverityClassifier` maps a failure to a severity + suspected cause + fix:

| Signal | Severity | Suspected cause |
| --- | --- | --- |
| tenant/isolation leak | critical | cross-tenant data exposure |
| HTTP 5xx during flow | high | backend/API error |
| blank screen + console error | high | frontend crash |
| permission/403/unauthorized | high | authorization issue |
| unexpected redirect | medium | auth/navigation |
| selector not found | medium | UI selector / not ready |

The same logic is exposed via the `AiAnalyzer` interface (`RuleBasedAiAnalyzer`), which is
designed so an LLM-backed analyzer can replace it later without changing the runner.

## History & comparison

Every run is archived to `qa/reports/<timestamp>/` (a copy of `latest/`).
`hqa report --compare` diffs the latest run against the previous one and prints status
changes (e.g. `passed → failed`) and newly added scenarios.

## Parallel runs

With `--workers N` (or `workers` in config) scenarios are sharded across N isolated
browsers; each worker produces a partial report and they are merged via `mergeReports`.
Artifact filenames are scenario-scoped, so parallel workers never collide.

## Viewing

- `hqa report` prints the summary and file links to the terminal.
- `hqa report --open` (or `hqa run --open`) opens the HTML report.
- Open a trace: `npx playwright show-trace qa/reports/latest/artifacts/traces/<file>.zip`.

# Safety

`SafetyGuard` (in `@hasan-qa-humans/core`) enforces guardrails configured under
`safety` in `qa.config.ts`:

```ts
safety: {
  testDataPrefix: "AUTO_HQA",
  allowDeleteOnlyWithPrefix: true,
  blockProductionBaseUrls: true,
  allowDestructiveActions: false,
  productionUrlPatterns: ["://www.", "://app.", "production", "prod."],
  allowedHostPatterns: ["localhost", "127.0.0.1", "staging", "test", "dev", "qa"],
}
```

## Rules

1. **Production is blocked by default.** If the base URL matches a `productionUrlPatterns`
   entry and is not an allowed host, `hqa run` refuses to start. Override only with
   `--allow-production` when you are certain the target is safe.
2. **Deletes require the prefix.** With `allowDeleteOnlyWithPrefix`, `SafetyGuard.assertDeletable(value)`
   throws unless `value` begins with `testDataPrefix` (default `AUTO_HQA`).
3. **Destructive actions stay off** unless `allowDestructiveActions: true` **and** the host
   matches `allowedHostPatterns` (i.e. a clearly non-production environment).
4. **All generated test data should be prefixed** with `testData(label)` →
   `AUTO_HQA_<label>` so it is easy to identify and clean up.
5. **No production data, no secrets in git.** Credentials live in `.env.qa` (gitignored);
   only `.env.qa.example` is committed.

## Environment detection

`hqa run` labels the environment as `local`, `staging`, `test`, or `unknown` based on the
base URL, and records it in the report. When it cannot confirm a safe environment, it warns
and keeps destructive actions disabled.

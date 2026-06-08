import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { auditStaticCode } from "../src/quality/staticAudit.js";

function discovery(root: string) {
  return {
    enabled: true,
    projectRoot: root,
    include: ["*.{ts,js,cjs,mjs}"],
    exclude: ["**/node_modules/**"],
    maxFiles: 100,
  };
}

test("auditStaticCode flags secrets, SQL injection and money-as-float", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hqa-static-"));
  writeFileSync(
    path.join(dir, "bad.js"),
    [
      'const apiKey = "sk_live_abcdef123456";',
      'db.query("SELECT * FROM users WHERE id = " + id);',
      "const price: number = 0;",
      "function c(amount){ return parseFloat(amount) }",
    ].join("\n"),
  );
  const findings = await auditStaticCode(discovery(dir));
  const cats = new Set(findings.map((f) => f.category));
  assert.ok(cats.has("code-hardcoded-secret"), "secret");
  assert.ok(cats.has("code-sql-injection"), "sql");
  assert.ok(cats.has("code-money-float"), "money");
  // كل ملاحظة تحمل موقعاً ودرجة واقتراحاً
  for (const f of findings) {
    assert.ok(f.scope.includes("bad.js"));
    assert.ok(f.suggestion.length > 0);
    assert.equal(f.domain, "code");
  }
});

test("auditStaticCode ignores process.env-based values (no false secret)", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hqa-static-"));
  writeFileSync(path.join(dir, "ok.js"), 'const apiKey = process.env.API_KEY;');
  const findings = await auditStaticCode(discovery(dir));
  assert.ok(!findings.some((f) => f.category === "code-hardcoded-secret"));
});

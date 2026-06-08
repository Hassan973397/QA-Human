import path from "node:path";
import fg from "fast-glob";
import { fs } from "../utils/file.js";
import { toPosix } from "../utils/path.js";
import type { DiscoveryConfig } from "../config/schema.js";
import type { UxFinding } from "../reporting/types.js";

/**
 * تدقيق ثابت لمصدر المشروع (باك إند + قاعدة بيانات + كل الكود) — يكمّل الاختبار
 * الخارجي بفحص لا يراه المتصفح: أسرار مكتوبة بالكود، حقن SQL، المال كـ float
 * (مخالفة لقانون هاسان)، eval، حقن أوامر، XSS عبر innerHTML، وملف .env مكشوف.
 * يقرأ الملفات فقط ولا يمسّ الأسرار (لا يقرأ محتوى .env إطلاقاً).
 */
const SCANNABLE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue"]);
const MAX_BYTES = 400 * 1024;

interface Rule {
  category: string;
  severity: UxFinding["severity"];
  title: string;
  test: RegExp;
  suggestion: string;
}

const RULES: Rule[] = [
  {
    category: "code-hardcoded-secret", severity: "high", title: "Possible hardcoded secret",
    test: /\b(api[_-]?key|secret|password|passwd|token|access[_-]?key|private[_-]?key)\b\s*[:=]\s*['"][^'"\n]{8,}['"]/i,
    suggestion: "Move secrets to environment variables; never commit them in code.",
  },
  {
    category: "code-sql-injection", severity: "high", title: "Possible SQL injection",
    test: /(query|execute|raw)\s*\(\s*[`'"][^`'")]*(select|insert|update|delete)[^`'"]*[`'"]?\s*\+|`[^`]*(select|insert|update|delete)[^`]*\$\{/i,
    suggestion: "Use parameterized queries / prepared statements, never string concatenation.",
  },
  {
    category: "code-money-float", severity: "medium", title: "Money handled as float/number",
    test: /\b(price|amount|total|balance|cost|subtotal|salary|fee)\b\s*:\s*number\b|parseFloat\s*\([^)]*\b(price|amount|total|balance|cost)\b/i,
    suggestion: "Store money as integer minor units (bigint), never float — avoids rounding errors.",
  },
  {
    category: "code-eval", severity: "medium", title: "Use of eval()",
    test: /(^|[^.\w])eval\s*\(/,
    suggestion: "Avoid eval() — it enables code injection. Use safe parsing instead.",
  },
  {
    category: "code-command-injection", severity: "high", title: "Possible command injection",
    test: /\b(exec|execSync)\s*\(\s*[`'][^`']*\$\{/,
    suggestion: "Use execFile/spawn with an argument array instead of an interpolated shell string.",
  },
  {
    category: "code-xss-innerhtml", severity: "medium", title: "Unsafe innerHTML / dangerouslySetInnerHTML",
    test: /dangerouslySetInnerHTML|\.innerHTML\s*=/,
    suggestion: "Sanitize HTML or render text; raw innerHTML can introduce XSS.",
  },
  {
    category: "code-debug-log", severity: "low", title: "Debug console.log left in source",
    test: /console\.(log|debug)\s*\(/,
    suggestion: "Remove stray debug logging or use a proper logger with levels.",
  },
];

export async function auditStaticCode(discovery: DiscoveryConfig): Promise<UxFinding[]> {
  const root = discovery.projectRoot;
  const out: UxFinding[] = [];
  const counts: Record<string, number> = {};
  const PER = 5;

  // ملف .env مكشوف (نتحقّق من وجوده وذكره في .gitignore فقط — لا نقرأ محتواه)
  await checkExposedEnv(root, out);

  let files: string[] = [];
  try {
    files = (await fg(discovery.include, {
      cwd: root, ignore: discovery.exclude, absolute: true, onlyFiles: true,
      dot: false, suppressErrors: true,
    }))
      .filter((p) => SCANNABLE.has(path.extname(p)))
      .slice(0, discovery.maxFiles);
  } catch {
    return out;
  }

  for (const abs of files) {
    let content = "";
    try {
      const stat = await fs.stat(abs);
      if (stat.size > MAX_BYTES) continue;
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    const rel = toPosix(path.relative(root, abs));
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
      for (const rule of RULES) {
        if (!rule.test.test(line)) continue;
        // تقليل الإيجابيات الكاذبة: تجاهل ما يستعمل process.env أو يشير لـ example
        if (rule.category === "code-hardcoded-secret" && /process\.env|example|placeholder|<|\$\{/.test(line)) continue;
        counts[rule.category] = (counts[rule.category] ?? 0) + 1;
        if (counts[rule.category]! > PER) continue;
        out.push({
          scope: `${rel}:${i + 1}`, domain: "code", category: rule.category,
          severity: rule.severity, title: rule.title,
          detail: `\`${line.trim().slice(0, 120)}\``, suggestion: rule.suggestion,
        });
      }
    }
  }

  for (const [cat, n] of Object.entries(counts)) {
    if (n > PER) {
      out.push({
        scope: root, domain: "code", category: `${cat}-more`, severity: "low",
        title: "More of the same", detail: `${n - PER} more "${cat}" hit(s) across the codebase.`,
        suggestion: "Address the pattern project-wide.",
      });
    }
  }
  return out;
}

/** يتحقّق من ملف .env مكشوف دون قراءة محتواه (احترام قاعدة الأسرار). */
async function checkExposedEnv(root: string, out: UxFinding[]): Promise<void> {
  try {
    const envPath = path.join(root, ".env");
    if (!(await fs.pathExists(envPath))) return;
    let ignored = false;
    const giPath = path.join(root, ".gitignore");
    if (await fs.pathExists(giPath)) {
      const gi = await fs.readFile(giPath, "utf8");
      ignored = /(^|\n)\s*\.env(\s|$|\*)/.test(gi);
    }
    if (!ignored) {
      out.push({
        scope: ".env", domain: "code", category: "code-env-exposed", severity: "high",
        title: ".env not git-ignored",
        detail: "A .env file exists but is not listed in .gitignore.",
        suggestion: "Add .env to .gitignore so secrets are never committed.",
      });
    }
  } catch {
    /* best-effort */
  }
}

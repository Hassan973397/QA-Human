import type { FormField, FormNode } from "../knowledge/types.js";
import type { DetectorContext, ScannedFile } from "./types.js";

const PURPOSE_HINTS: Array<{ re: RegExp; purpose: string }> = [
  { re: /login|signin|sign-in|تسجيل.?الدخول/i, purpose: "login" },
  { re: /checkout|الدفع|إتمام.?الطلب/i, purpose: "checkout" },
  { re: /order|طلب/i, purpose: "order" },
  { re: /customer|عميل|زبون/i, purpose: "customer" },
  { re: /product|منتج/i, purpose: "product" },
  { re: /status|حالة/i, purpose: "status-update" },
  { re: /register|signup|sign-up|إنشاء.?حساب/i, purpose: "register" },
];

/** Detects forms and their fields from JSX/HTML <form> blocks. */
export function detectForms(ctx: DetectorContext): FormNode[] {
  const forms: FormNode[] = [];
  for (const file of ctx.files) {
    if (!/\.(t|j)sx?|\.html|\.vue$/.test(file.relPath)) continue;
    if (!/<form/i.test(file.content)) continue;
    forms.push(...extractForms(file));
  }
  return forms;
}

function extractForms(file: ScannedFile): FormNode[] {
  const out: FormNode[] = [];
  const formRe = /<form\b[\s\S]*?<\/form>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = formRe.exec(file.content)) !== null) {
    const block = match[0];
    const fields = extractFields(block);
    const submitText = extractSubmitText(block);
    const purpose = guessPurpose(block, file.relPath, fields);
    out.push({
      name: `${purpose ?? "form"}_${++index}`,
      source: file.relPath,
      fields,
      submitText,
      purpose,
    });
  }
  return out;
}

function extractFields(block: string): FormField[] {
  const fields: FormField[] = [];
  const tagRe = /<(input|select|textarea)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(block)) !== null) {
    const attrs = m[2] ?? "";
    fields.push({
      type: attr(attrs, "type") ?? (m[1] === "input" ? "text" : m[1]),
      name: attr(attrs, "name"),
      placeholder: attr(attrs, "placeholder"),
      label: attr(attrs, "aria-label"),
      required: /\brequired\b/.test(attrs),
    });
  }
  return fields;
}

function extractSubmitText(block: string): string | undefined {
  const btn = block.match(/<button\b[^>]*>([\s\S]*?)<\/button>/i);
  if (btn) return clean(btn[1] ?? "");
  const input = block.match(/<input\b[^>]*type=["']submit["'][^>]*value=["']([^"']+)["']/i);
  return input ? input[1] : undefined;
}

function guessPurpose(block: string, rel: string, fields: FormField[]): string | undefined {
  const haystack = `${rel} ${block}`;
  for (const hint of PURPOSE_HINTS) {
    if (hint.re.test(haystack)) return hint.purpose;
  }
  if (fields.some((f) => f.type === "password")) return "login";
  return undefined;
}

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`, "i"));
  return m ? m[1] : undefined;
}

function clean(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim() || "submit";
}

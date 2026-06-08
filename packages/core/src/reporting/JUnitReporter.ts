import type { QaReport, ScenarioResult } from "./types.js";

/**
 * مُصيّر JUnit XML — كي تستهلك خطوط CI/CD (GitHub Actions, GitLab, Jenkins)
 * نتائج التشغيل وتعرضها وتكسر البناء عند الفشل. كل سيناريو = testcase؛ الفاشل
 * يحمل <failure>، والمتجاوز/المحظور <skipped>.
 */
export function renderJUnitReport(report: QaReport): string {
  const s = report.summary;
  const cases = report.scenarios.map(renderCase).join("\n");
  const ts = (report.durationMs / 1000).toFixed(3);
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="hasan-qa-humans" tests="${s.total}" failures="${s.failed}" skipped="${s.skipped + s.blocked}" time="${ts}">
  <testsuite name="${attr(report.appName)}" tests="${s.total}" failures="${s.failed}" skipped="${s.skipped + s.blocked}" time="${ts}">
${cases}
  </testsuite>
</testsuites>
`;
}

function renderCase(sc: ScenarioResult): string {
  const time = (sc.durationMs / 1000).toFixed(3);
  const open = `    <testcase classname="${attr(sc.tags.join(".") || "qa")}" name="${attr(sc.id)} — ${attr(sc.title)}" time="${time}">`;
  if (sc.status === "failed") {
    const msg = sc.failureReason || sc.suspectedRootCause || "scenario failed";
    return `${open}\n      <failure message="${attr(msg)}" type="${attr(sc.severity)}">${text(detailFor(sc))}</failure>\n    </testcase>`;
  }
  if (sc.status === "skipped" || sc.status === "blocked") {
    return `${open}\n      <skipped message="${attr(sc.skipReason || sc.status)}"/>\n    </testcase>`;
  }
  return `${open}</testcase>`;
}

function detailFor(sc: ScenarioResult): string {
  const lines = [sc.failureReason, sc.suspectedRootCause && `Root cause: ${sc.suspectedRootCause}`, sc.recommendedFix && `Fix: ${sc.recommendedFix}`];
  return lines.filter(Boolean).join("\n");
}

function attr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function text(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

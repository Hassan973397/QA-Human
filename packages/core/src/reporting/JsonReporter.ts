import { stableStringify } from "../utils/safeJson.js";
import type { QaReport } from "./types.js";

export function renderJsonReport(report: QaReport): string {
  return stableStringify(report);
}

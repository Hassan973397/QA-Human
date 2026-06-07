import { defaultSelectorHints } from "../config/defaults.js";

/** Re-export the baseline selector hints so the registry can seed itself. */
export const defaultSelectors: Record<string, string[]> = defaultSelectorHints;

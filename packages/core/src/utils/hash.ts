import { createHash } from "node:crypto";

/** Stable short hash of a string, used for discovery cache signatures. */
export function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

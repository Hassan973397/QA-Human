/**
 * JSON helpers that never throw on the happy path and produce stable, readable output.
 */

export function safeParse<T = unknown>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, replacer, 2);
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (value instanceof Set) {
    return Array.from(value.values());
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

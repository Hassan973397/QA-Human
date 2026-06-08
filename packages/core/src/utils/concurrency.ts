/**
 * Runs an async mapper over items with a bounded concurrency limit. Preserves
 * input order in the result array. Used to read/scan many files in parallel
 * without exhausting file descriptors.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}

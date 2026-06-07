/**
 * Per-human memory plus access to a shared, cross-human memory so e.g. the
 * customer can store an orderId that the merchant later reads.
 */
export class HumanMemory {
  private readonly own = new Map<string, unknown>();

  constructor(private readonly shared: Map<string, unknown>) {}

  remember(key: string, value: unknown): void {
    this.own.set(key, value);
  }

  recall<T = unknown>(key: string): T | undefined {
    return (this.own.has(key) ? this.own.get(key) : this.shared.get(key)) as T | undefined;
  }

  share(key: string, value: unknown): void {
    this.shared.set(key, value);
  }

  recallShared<T = unknown>(key: string): T | undefined {
    return this.shared.get(key) as T | undefined;
  }
}

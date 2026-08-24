export type EffectPriority = number;

export type QueuedEffect<T> = T & {
  queueKey: string;
  priority: EffectPriority;
  enqueuedAt: number;
};

export class EffectQueue<T> {
  private items: Array<QueuedEffect<T>> = [];
  private seen = new Set<string>();
  private readonly max: number;
  constructor(max = 24) {
    this.max = max;
  }

  enqueue(item: T, queueKey: string, priority: EffectPriority): {
    accepted: QueuedEffect<T> | null;
    dropped: Array<QueuedEffect<T>>;
  } {
    if (this.seen.has(queueKey)) return { accepted: null, dropped: [] };
    this.seen.add(queueKey);
    const row: QueuedEffect<T> = { ...(item as T), queueKey, priority, enqueuedAt: Date.now() };
    this.items.push(row);
    this.items.sort((a, b) => b.priority - a.priority || a.enqueuedAt - b.enqueuedAt);
    const dropped = this.items.length > this.max ? this.items.splice(this.max) : [];
    for (const d of dropped) this.seen.delete(d.queueKey);
    if (dropped.some((d) => d.queueKey === queueKey)) {
      return { accepted: null, dropped };
    }
    return { accepted: row, dropped };
  }

  dequeue(): QueuedEffect<T> | null {
    return this.items.shift() || null;
  }

  get length(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
    this.seen.clear();
  }
}

const inflight = new Map<string, Promise<unknown>>();

/** Deduplicate identical in-flight read promises. Never use for financial writes. */
export function dedupeInflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key);
  if (hit) return hit as Promise<T>;
  const pending = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

export function clearInflightDedupe(): void {
  inflight.clear();
}

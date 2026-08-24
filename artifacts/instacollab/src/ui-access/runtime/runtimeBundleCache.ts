export type CachedBundle = {
  snapshotId: string;
  checksum: string;
  version: number;
  activatedAt: number;
  payload: unknown;
};

const memory = new Map<string, CachedBundle>();
const inflight = new Map<string, Promise<CachedBundle | null>>();
const STORAGE_KEY = "unilives.runtime-bundle.lkg";

export function memoryGet(checksum: string): CachedBundle | null {
  return memory.get(checksum) || null;
}

export function memorySet(bundle: CachedBundle): void {
  memory.set(bundle.checksum, bundle);
}

export function persistentGet(): CachedBundle | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBundle;
    if (!parsed?.checksum || !parsed.snapshotId) return null;
    memorySet(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function persistentSet(bundle: CachedBundle): void {
  memorySet(bundle);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
  } catch {
    /* quota / private mode */
  }
}

export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const next = fn().finally(() => inflight.delete(key));
  inflight.set(key, next as Promise<CachedBundle | null>);
  return next;
}

export function clearCorruptedCache(): void {
  memory.clear();
  if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
}

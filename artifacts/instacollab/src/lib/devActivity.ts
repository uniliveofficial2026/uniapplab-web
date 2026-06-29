/**
 * In-app live activity log (dev builds only). Wired from db.save() and navigation.
 */

export type DevActivityEntry = {
  id: string;
  at: number;
  kind: 'data' | 'nav' | 'ui' | 'test' | 'note';
  message: string;
  detail?: string;
};

const MAX_ENTRIES = 120;
const listeners = new Set<() => void>();
let entries: DevActivityEntry[] = [];
let revision = 0;

function notify() {
  revision += 1;
  listeners.forEach((l) => l());
}

function push(kind: DevActivityEntry['kind'], message: string, detail?: string) {
  if (!import.meta.env.DEV) return;
  const entry: DevActivityEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    kind,
    message,
    detail: detail?.slice(0, 500),
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  notify();
}

export function logDevActivity(
  kind: DevActivityEntry['kind'],
  message: string,
  detail?: string
) {
  push(kind, message, detail);
}

export function subscribeDevActivity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDevActivityEntries(): DevActivityEntry[] {
  return entries;
}

export function getDevActivityRevision(): number {
  return revision;
}

export function clearDevActivity() {
  entries = [];
  notify();
}

function summarizeValue(key: string, data: unknown): string {
  if (data == null) return 'null';
  if (Array.isArray(data)) return `${data.length} items`;
  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (key === 'messages' && typeof o === 'object' && !Array.isArray(o)) {
      const chats = Object.keys(o).length;
      const msgs = Object.values(o).reduce<number>(
        (n, arr) => n + (Array.isArray(arr) ? arr.length : 0),
        0
      );
      return `${chats} chats, ${msgs} messages`;
    }
    if (key === 'follow_graph' && o.following && typeof o.following === 'object') {
      const edges = Object.values(o.following as Record<string, string[]>).reduce(
        (n, list) => n + (Array.isArray(list) ? list.length : 0),
        0
      );
      return `${Object.keys(o.following).length} users, ${edges} follows`;
    }
    if (key === 'stories' && !Array.isArray(o)) {
      return `${Object.keys(o).length} story users`;
    }
    return `${Object.keys(o).length} keys`;
  }
  return String(data);
}

let lastSaveKey = '';
let lastSaveAt = 0;

/** Called from db.save on every collection write (dev only). */
export function recordCollectionSave(key: string, data: unknown) {
  if (!import.meta.env.DEV) return;
  const now = Date.now();
  if (key === lastSaveKey && now - lastSaveAt < 200) return;
  lastSaveKey = key;
  lastSaveAt = now;
  push('data', `save · ${key}`, summarizeValue(key, data));
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as Window & { __devLog?: typeof logDevActivity }).__devLog = logDevActivity;
}

/**
 * Durable IndexedDB outbox for server mutations (chat send, etc.).
 * Survives reload, offline periods, and temporary API failures.
 */
export type OutboxDomain = 'chat' | 'profile' | 'social' | 'wallet' | 'gift' | 'live';

export type OutboxState = 'pending' | 'sending' | 'failed';

export type OutboxItem = {
  id: string;
  userId: string;
  domain: OutboxDomain;
  operation: string;
  mutationId: string;
  payload: unknown;
  state: OutboxState;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  lastError?: string;
};

const DB_NAME = 'unilive_outbox';
const STORE = 'items';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openOutboxDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by_user_state', ['userId', 'state'], { unique: false });
        store.createIndex('by_mutation', ['userId', 'domain', 'mutationId'], { unique: true });
        store.createIndex('by_next_attempt', 'nextAttemptAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('outbox open failed'));
  });
  return dbPromise;
}

export async function getOutboxItemByMutation(
  userId: string,
  domain: OutboxDomain,
  mutationId: string,
): Promise<OutboxItem | null> {
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('by_mutation').get([userId, domain, mutationId]);
    req.onsuccess = () => resolve((req.result as OutboxItem | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOutboxItemsByMutation(
  userId: string,
  domain: OutboxDomain,
  mutationId: string,
): Promise<void> {
  const existing = await getOutboxItemByMutation(userId, domain, mutationId);
  if (!existing) return;
  await removeOutboxItem(existing.id);
}

export async function enqueueOutboxItem(
  item: Omit<OutboxItem, 'state' | 'attempts' | 'nextAttemptAt' | 'createdAt'> & {
    state?: OutboxState;
    attempts?: number;
    nextAttemptAt?: number;
    createdAt?: number;
  },
): Promise<OutboxItem> {
  const existing = await getOutboxItemByMutation(item.userId, item.domain, item.mutationId);
  if (existing) {
    existing.state = 'pending';
    existing.nextAttemptAt = Date.now();
    existing.lastError = undefined;
    await updateOutboxItem(existing);
    if (import.meta.env.DEV) {
      console.info('[data:outbox] refreshed', {
        domain: existing.domain,
        operation: existing.operation,
        mutationId: existing.mutationId,
      });
    }
    return existing;
  }

  const record: OutboxItem = {
    ...item,
    state: item.state ?? 'pending',
    attempts: item.attempts ?? 0,
    nextAttemptAt: item.nextAttemptAt ?? Date.now(),
    createdAt: item.createdAt ?? Date.now(),
  };
  const db = await openOutboxDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  if (import.meta.env.DEV) {
    console.info('[data:outbox] queued', {
      domain: record.domain,
      operation: record.operation,
      mutationId: record.mutationId,
    });
  }
  return record;
}

export async function listDueOutboxItems(userId: string, now = Date.now()): Promise<OutboxItem[]> {
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('by_user_state');
    const results: OutboxItem[] = [];
    const STALE_SENDING_MS = 60_000;
    const states: OutboxState[] = ['pending', 'failed', 'sending'];
    let remaining = states.length;
    for (const state of states) {
      const req = index.getAll(IDBKeyRange.only([userId, state]));
      req.onsuccess = () => {
        for (const item of req.result as OutboxItem[]) {
          if (item.state === 'pending' || item.state === 'failed') {
            if (item.nextAttemptAt <= now) results.push(item);
          } else if (
            item.state === 'sending' &&
            (now - (item.createdAt || 0) > STALE_SENDING_MS || item.nextAttemptAt <= now)
          ) {
            results.push(item);
          }
        }
        remaining -= 1;
        if (remaining === 0) resolve(results.sort((a, b) => a.createdAt - b.createdAt));
      };
      req.onerror = () => reject(req.error);
    }
  });
}

/** Claim an outbox item for exclusive processing (lease). Returns false if another worker holds it. */
export async function claimOutboxItem(id: string, leaseMs = 30_000): Promise<OutboxItem | null> {
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as OutboxItem | undefined;
      if (!item) {
        resolve(null);
        return;
      }
      if (item.state === 'sending' && item.nextAttemptAt > Date.now()) {
        resolve(null);
        return;
      }
      item.state = 'sending';
      item.nextAttemptAt = Date.now() + leaseMs;
      store.put(item);
      resolve(item);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function updateOutboxItem(item: OutboxItem): Promise<void> {
  const db = await openOutboxDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeOutboxItem(id: string): Promise<void> {
  const db = await openOutboxDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function computeOutboxBackoffMs(attempts: number): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

export async function clearOutboxForUser(userId: string): Promise<void> {
  const db = await openOutboxDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const index = store.index('by_user_state');
    const req = index.openKeyCursor(IDBKeyRange.bound([userId], [userId, '\uffff']));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

import type { WatchTogetherMediaKind } from './watchTogetherMedia';

const DB_NAME = 'WatchTogetherRoomMedia';
const DB_VERSION = 1;
const STORE_NAME = 'roomMedia';

export type StoredWatchTogetherUpload = {
  roomId: string;
  blob: Blob;
  mimeType: string;
  kind: WatchTogetherMediaKind;
  fileName: string;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open media storage'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'roomId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = run(store);
        request.onerror = () => reject(request.error ?? new Error('Media storage transaction failed'));
        request.onsuccess = () => resolve(request.result);
        tx.onerror = () => reject(tx.error ?? new Error('Media storage transaction failed'));
      }),
  );
}

export async function saveWatchTogetherUpload(
  roomId: string,
  file: File,
  kind: WatchTogetherMediaKind,
): Promise<StoredWatchTogetherUpload> {
  const record: StoredWatchTogetherUpload = {
    roomId,
    blob: file,
    mimeType: file.type || (kind === 'audio' ? 'audio/mpeg' : 'video/mp4'),
    kind,
    fileName: file.name,
    updatedAt: Date.now(),
  };
  await runTransaction('readwrite', (store) => store.put(record));
  return record;
}

export async function loadWatchTogetherUpload(
  roomId: string,
): Promise<StoredWatchTogetherUpload | null> {
  try {
    const record = await runTransaction<StoredWatchTogetherUpload | undefined>(
      'readonly',
      (store) => store.get(roomId),
    );
    if (!record?.blob) return null;
    return record;
  } catch {
    return null;
  }
}

export async function deleteWatchTogetherUpload(roomId: string): Promise<void> {
  try {
    await runTransaction('readwrite', (store) => store.delete(roomId));
  } catch {
    // ignore cleanup failures
  }
}

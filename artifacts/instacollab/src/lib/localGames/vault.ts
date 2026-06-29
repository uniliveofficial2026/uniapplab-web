import type { LocalGameBundle } from './types';

const DB_NAME = 'InstaCollabLocalGames';
const DB_VERSION = 1;
const STORE = 'bundles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveLocalGameBundle(bundle: LocalGameBundle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(bundle);
  });
  db.close();
}

export async function getLocalGameBundle(gameId: string): Promise<LocalGameBundle | undefined> {
  const db = await openDb();
  const bundle = await new Promise<LocalGameBundle | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(gameId);
    request.onsuccess = () => resolve(request.result as LocalGameBundle | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return bundle;
}

export async function deleteLocalGameBundle(gameId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(gameId);
  });
  db.close();
}

export async function getLocalGamesStorageBytes(): Promise<number> {
  const db = await openDb();
  const bundles = await new Promise<LocalGameBundle[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as LocalGameBundle[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return bundles.reduce((sum, bundle) => {
    return (
      sum +
      bundle.files.reduce((fileSum, file) => fileSum + (file.data?.byteLength ?? 0), 0)
    );
  }, 0);
}

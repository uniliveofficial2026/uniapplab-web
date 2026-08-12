import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { isFirebaseConfigured } from './config';
import { ensureBundledFirebaseConfig, getRuntimeFirebaseConfig } from './runtimeAuthConfig';
import { getFirebaseWebConfig } from './firebaseConfig';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let storage: FirebaseStorage | null = null;

const FIRESTORE_WEB_STORAGE_PREFIXES = [
  'firestore_clients_',
  'firestore_mutations_',
  'firestore_sequence_numbers_',
  'firebase:firestore:',
];

/** Drop Firestore multi-tab / client-state keys that fill localStorage. */
export function purgeFirestoreWebStorage(): number {
  if (typeof localStorage === 'undefined') return 0;
  let removed = 0;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        FIRESTORE_WEB_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
        /^firestore_/i.test(key)
      ) {
        doomed.push(key);
      }
    }
    for (const key of doomed) {
      try {
        localStorage.removeItem(key);
        removed += 1;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* private mode / blocked storage */
  }
  return removed;
}

function localStorageAllowsWrite(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const probe = `__fs_quota_probe_${Date.now()}`;
  try {
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function preferMemoryFirestoreCache(): boolean {
  // Multi-tab persistent cache writes firestore_clients_* into localStorage and
  // throws INTERNAL ASSERTION / QuotaExceeded when storage is full — blanking Karaoke.
  if (!localStorageAllowsWrite()) return true;
  try {
    // Dynamic import avoided — sync check for Supabase-primary installs.
    const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
    const key = String(
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        '',
    ).trim();
    if (url && key) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Single Firebase app — reuse [DEFAULT] if already registered (avoids duplicate-app). */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;

  const existing = getApps();
  if (existing.length > 0) {
    app = getApp();
    return app;
  }

  if (!app) {
    ensureBundledFirebaseConfig();
    const options = getFirebaseWebConfig() || getRuntimeFirebaseConfig();
    if (!options) return null;
    app = initializeApp(options);
    void import('./runtimeAuthConfig').then((m) => m.loadRuntimeFirebaseConfig());
  }
  return app;
}

/** Dev-only: connect Auth/Firestore emulators when VITE_FIREBASE_USE_EMULATORS=true */
export function connectFirebaseEmulatorsIfEnabled(): void {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_FIREBASE_USE_EMULATORS !== 'true') return;
  const authInstance = getFirebaseAuth();
  const db = getFirebaseFirestore();
  if (authInstance) {
    try {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    } catch {
      /* already connected */
    }
  }
  if (db) {
    try {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    } catch {
      /* already connected */
    }
  }
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) {
    auth = getAuth(firebaseApp);
    connectFirebaseEmulatorsIfEnabled();
  }
  return auth;
}

export function getFirebaseFirestore(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!firestore) {
    const dbId = String(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || 'default').trim();
    const useMemory = preferMemoryFirestoreCache();
    try {
      if (useMemory) {
        // Avoid localStorage multi-tab client state entirely (QuotaExceeded → karaoke crash).
        firestore = initializeFirestore(
          firebaseApp,
          { localCache: memoryLocalCache() },
          dbId,
        );
      } else {
        // Single-tab persistence only — never persistentMultipleTabManager (localStorage).
        firestore = initializeFirestore(
          firebaseApp,
          {
            localCache: persistentLocalCache({
              tabManager: persistentSingleTabManager(undefined),
            }),
          },
          dbId,
        );
      }
    } catch {
      try {
        purgeFirestoreWebStorage();
        firestore = initializeFirestore(
          firebaseApp,
          { localCache: memoryLocalCache() },
          dbId,
        );
      } catch {
        firestore = dbId === 'default' ? getFirestore(firebaseApp) : getFirestore(firebaseApp, dbId);
      }
    }
  }
  return firestore;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!storage) storage = getStorage(firebaseApp);
  return storage;
}

/** @deprecated use getFirebaseFirestore */
export const getFirestoreDB = getFirebaseFirestore;

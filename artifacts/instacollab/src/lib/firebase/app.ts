import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { isFirebaseConfigured } from './config';
import { ensureBundledFirebaseConfig, getRuntimeFirebaseConfig } from './runtimeAuthConfig';
import { getFirebaseWebConfig } from './firebaseConfig';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

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
    try {
      firestore = initializeFirestore(
        firebaseApp,
        {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        },
        dbId,
      );
    } catch {
      firestore = getFirestore(firebaseApp, dbId === 'default' ? undefined : dbId);
    }
  }
  return firestore;
}

/** @deprecated use getFirebaseFirestore */
export const getFirestoreDB = getFirebaseFirestore;

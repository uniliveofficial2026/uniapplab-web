import {
  getFirebaseApiKey,
  getFirebaseAppId,
  getFirebaseAuthDomain,
  getFirebaseDatabaseUrl,
  getFirebaseMessagingSenderId,
  getFirebaseProjectId,
  getFirebaseStorageBucket,
  isFirebaseConfigured,
} from './config';
import { ensureBundledFirebaseConfig, getRuntimeFirebaseConfig } from './runtimeAuthConfig';

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
};

/** Firebase Web SDK options object for `initializeApp()`. */
export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  ensureBundledFirebaseConfig();
  if (!isFirebaseConfigured()) return null;
  const runtime = getRuntimeFirebaseConfig();
  const databaseURL = runtime?.databaseURL || getFirebaseDatabaseUrl();
  return {
    apiKey: runtime?.apiKey || getFirebaseApiKey(),
    authDomain: runtime?.authDomain || getFirebaseAuthDomain(),
    projectId: runtime?.projectId || getFirebaseProjectId(),
    storageBucket: runtime?.storageBucket || getFirebaseStorageBucket(),
    messagingSenderId: runtime?.messagingSenderId || getFirebaseMessagingSenderId(),
    appId: runtime?.appId || getFirebaseAppId(),
    ...(databaseURL ? { databaseURL } : {}),
  };
}

export function getFirebaseConfigStatus(): {
  configured: boolean;
  missing: string[];
} {
  const required: Array<[string, string]> = [
    ['VITE_FIREBASE_API_KEY', getFirebaseApiKey()],
    ['VITE_FIREBASE_AUTH_DOMAIN', getFirebaseAuthDomain()],
    ['VITE_FIREBASE_PROJECT_ID', getFirebaseProjectId()],
    ['VITE_FIREBASE_APP_ID', getFirebaseAppId()],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  return { configured: missing.length === 0, missing };
}

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
  if (!isFirebaseConfigured()) return null;
  const databaseURL = getFirebaseDatabaseUrl();
  return {
    apiKey: getFirebaseApiKey(),
    authDomain: getFirebaseAuthDomain(),
    projectId: getFirebaseProjectId(),
    storageBucket: getFirebaseStorageBucket(),
    messagingSenderId: getFirebaseMessagingSenderId(),
    appId: getFirebaseAppId(),
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

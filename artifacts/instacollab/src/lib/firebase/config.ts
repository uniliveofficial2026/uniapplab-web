import {
  ensureBundledFirebaseConfig,
  getRuntimeFirebaseConfig,
  loadRuntimeFirebaseConfig,
} from './runtimeAuthConfig';

export function isFirebaseConfigured(): boolean {
  ensureBundledFirebaseConfig();
  const runtime = getRuntimeFirebaseConfig();
  const apiKey = runtime?.apiKey || getFirebaseApiKeyFromEnv();
  const authDomain = runtime?.authDomain || getFirebaseAuthDomainFromEnv();
  const projectId = runtime?.projectId || getFirebaseProjectIdFromEnv();
  const appId = runtime?.appId || getFirebaseAppIdFromEnv();
  return (
    apiKey.length > 0 &&
    authDomain.length > 0 &&
    projectId.length > 0 &&
    appId.length > 0 &&
    !apiKey.includes('your_firebase_api_key')
  );
}

function getFirebaseApiKeyFromEnv(): string {
  return String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
}

function getFirebaseAuthDomainFromEnv(): string {
  return String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
}

function getFirebaseProjectIdFromEnv(): string {
  return String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
}

function getFirebaseAppIdFromEnv(): string {
  return String(import.meta.env.VITE_FIREBASE_APP_ID || '').trim();
}

export function getFirebaseApiKey(): string {
  ensureBundledFirebaseConfig();
  return getRuntimeFirebaseConfig()?.apiKey || getFirebaseApiKeyFromEnv();
}

export function getFirebaseAuthDomain(): string {
  ensureBundledFirebaseConfig();
  return getRuntimeFirebaseConfig()?.authDomain || getFirebaseAuthDomainFromEnv();
}

export function getFirebaseProjectId(): string {
  ensureBundledFirebaseConfig();
  return getRuntimeFirebaseConfig()?.projectId || getFirebaseProjectIdFromEnv();
}

export function getFirebaseStorageBucket(): string {
  ensureBundledFirebaseConfig();
  return (
    getRuntimeFirebaseConfig()?.storageBucket ||
    String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim()
  );
}

export function getFirebaseMessagingSenderId(): string {
  ensureBundledFirebaseConfig();
  return (
    getRuntimeFirebaseConfig()?.messagingSenderId ||
    String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim()
  );
}

export function getFirebaseAppId(): string {
  ensureBundledFirebaseConfig();
  return getRuntimeFirebaseConfig()?.appId || getFirebaseAppIdFromEnv();
}

export function getFirebaseDatabaseUrl(): string {
  ensureBundledFirebaseConfig();
  return (
    getRuntimeFirebaseConfig()?.databaseURL ||
    String(import.meta.env.VITE_FIREBASE_DATABASE_URL || '').trim()
  );
}

export function getFirebaseMeasurementId(): string {
  ensureBundledFirebaseConfig();
  return (
    getRuntimeFirebaseConfig()?.measurementId ||
    String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '').trim()
  );
}

export { loadRuntimeFirebaseConfig };

export function isFirebaseConfigured(): boolean {
  const apiKey = getFirebaseApiKey();
  const authDomain = getFirebaseAuthDomain();
  const projectId = getFirebaseProjectId();
  const appId = getFirebaseAppId();
  return (
    apiKey.length > 0 &&
    authDomain.length > 0 &&
    projectId.length > 0 &&
    appId.length > 0 &&
    !apiKey.includes('your_firebase_api_key')
  );
}

export function getFirebaseApiKey(): string {
  return String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
}

export function getFirebaseAuthDomain(): string {
  return String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
}

export function getFirebaseProjectId(): string {
  return String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
}

export function getFirebaseStorageBucket(): string {
  return String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim();
}

export function getFirebaseMessagingSenderId(): string {
  return String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();
}

export function getFirebaseAppId(): string {
  return String(import.meta.env.VITE_FIREBASE_APP_ID || '').trim();
}

export function getFirebaseDatabaseUrl(): string {
  return String(import.meta.env.VITE_FIREBASE_DATABASE_URL || '').trim();
}

export function getFirebaseMeasurementId(): string {
  return String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '').trim();
}

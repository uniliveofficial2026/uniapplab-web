import { db } from './db/localDb';

export type IntegrationEnvKey =
  | 'VITE_SUPABASE_URL'
  | 'VITE_SUPABASE_ANON_KEY'
  | 'VITE_SUPABASE_PUBLISHABLE_KEY'
  | 'VITE_LIVEKIT_URL'
  | 'VITE_TENCENT_WEBAR_APP_ID'
  | 'VITE_TENCENT_WEBAR_LICENSE_KEY'
  | 'VITE_TENCENT_WEBAR_TOKEN'
  | 'VITE_DEEPAR_LICENSE_KEY'
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID';

export function readIntegrationEnv(key: string): string {
  const settings = db.settings;
  const overrides = (settings?.integrationEnv ?? {}) as Record<string, string>;
  const fromOverride = String(overrides[key] ?? '').trim();
  if (fromOverride) return fromOverride;
  return String(import.meta.env[key] ?? '').trim();
}

export function getIntegrationEnvOverrides(): Record<string, string> {
  return { ...((db.settings?.integrationEnv ?? {}) as Record<string, string>) };
}

export function saveIntegrationEnv(overrides: Record<string, string>): void {
  db.updateSettings({ integrationEnv: overrides });
}

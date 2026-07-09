import { db } from '../db/localDb';
import { scheduleLiveSessionSync } from '../liveSessionSync';
import { isSupabaseConfigured } from '../supabase/config';
import { isUnifiedLiveMode } from '../unifiedLive';
import { enableDevLocalAuthBypass } from './devLocalAuth';

export const DEMO_EMAIL = 'demo@unilive.app';
export const DEMO_EMAIL_LEGACY = 'demo@instacollab.app';
export const DEMO_EMAIL_SARAH = 'sarah@unilive.app';
export const DEMO_PASSWORD = 'demo123';

const DEMO_EMAILS = new Set([
  DEMO_EMAIL,
  DEMO_EMAIL_LEGACY,
  DEMO_EMAIL_SARAH,
  'sarah@instacollab.app',
]);

export function isKnownLocalDemoEmail(email: string): boolean {
  return DEMO_EMAILS.has(email.trim().toLowerCase());
}

type DemoLoginOptions = {
  /** Dev: use local IDB demo when cloud sync is unavailable (Supabase down, API 404, etc.). */
  offlineFallback?: boolean;
};

/**
 * Local demo login (IndexedDB u1/u2). Enables dev bypass before session write so
 * Supabase SIGNED_OUT events do not immediately log the user back out.
 */
export function loginDemoAccountLocal(
  email: string,
  password: string,
): { ok: true } | { ok: false; reason: string } {
  const normalized = email.trim().toLowerCase();
  if (!isKnownLocalDemoEmail(normalized)) {
    return { ok: false, reason: 'Not a demo account.' };
  }
  if (password !== DEMO_PASSWORD) {
    return {
      ok: false,
      reason: `Demo password is ${DEMO_PASSWORD}.`,
    };
  }

  enableDevLocalAuthBypass();
  db.ensureDemoAuthAccounts();
  const result = db.signInWithCredentials(normalized, password);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  scheduleLiveSessionSync(result.userId);
  return { ok: true };
}

/** Dev-only local demo accounts in IndexedDB. */
export function tryLocalDemoLogin(
  email: string,
  password: string,
  options?: DemoLoginOptions,
): { ok: true } | { ok: false; reason: string } | null {
  if (!import.meta.env.DEV || !isKnownLocalDemoEmail(email)) return null;
  if (!options?.offlineFallback) {
    if (isSupabaseConfigured()) return null;
    if (isUnifiedLiveMode()) return null;
  }
  return loginDemoAccountLocal(email, password);
}

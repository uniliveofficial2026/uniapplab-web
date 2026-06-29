import { db } from '../db/localDb';
import { enableDevLocalAuthBypass } from './devLocalAuth';

const DEMO_EMAILS = new Set(['demo@instacollab.app', 'sarah@instacollab.app']);

export function isKnownLocalDemoEmail(email: string): boolean {
  return DEMO_EMAILS.has(email.trim().toLowerCase());
}

/** Dev-only: demo@instacollab.app / demo123 exist in local IDB, not in Supabase/Firebase. */
export function tryLocalDemoLogin(
  email: string,
  password: string
): { ok: true } | { ok: false; reason: string } | null {
  if (!import.meta.env.DEV || !isKnownLocalDemoEmail(email)) return null;
  db.ensureDemoAuthAccounts();
  const result = db.signInWithCredentials(email, password);
  if (!result.ok) {
    return { ok: false, reason: 'Demo password is demo123 for demo@instacollab.app and sarah@instacollab.app.' };
  }
  enableDevLocalAuthBypass();
  return { ok: true };
}

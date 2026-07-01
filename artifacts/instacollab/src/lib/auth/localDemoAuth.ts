import { db } from '../db/localDb';
import { scheduleLiveSessionSync } from '../liveSessionSync';
import { isSupabaseConfigured } from '../supabase/config';
import { isUnifiedLiveMode } from '../unifiedLive';
import { enableDevLocalAuthBypass } from './devLocalAuth';

const DEMO_EMAILS = new Set(['demo@instacollab.app', 'sarah@instacollab.app']);

export function isKnownLocalDemoEmail(email: string): boolean {
  return DEMO_EMAILS.has(email.trim().toLowerCase());
}

/** Dev-only offline fallback when Supabase is not configured. */
export function tryLocalDemoLogin(
  email: string,
  password: string
): { ok: true } | { ok: false; reason: string } | null {
  if (!import.meta.env.DEV || !isKnownLocalDemoEmail(email)) return null;
  if (isSupabaseConfigured()) return null;
  if (isUnifiedLiveMode()) return null;
  db.ensureDemoAuthAccounts();
  const result = db.signInWithCredentials(email, password);
  if (!result.ok) {
    return { ok: false, reason: 'Demo password is demo123 for demo@instacollab.app and sarah@instacollab.app.' };
  }
  enableDevLocalAuthBypass();
  scheduleLiveSessionSync(result.userId);
  return { ok: true };
}

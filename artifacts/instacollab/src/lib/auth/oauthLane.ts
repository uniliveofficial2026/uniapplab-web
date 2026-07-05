import type { AuthBackend } from './types';
import { invalidateSupabaseHealthCache, probeSupabaseOAuthReady } from './health';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';
import {
  isSupabaseOAuthDegraded,
  markSupabaseOAuthDegraded,
} from './providerState';

const OAUTH_PROBE_MS = 8_000;

/**
 * Pick OAuth redirect lane before sending the browser anywhere.
 * When Supabase /authorize is down (522), use Firebase popup/redirect instead.
 */
export async function resolveLiveOAuthBackend(): Promise<AuthBackend> {
  if (!isSupabaseConfigured()) {
    return isFirebaseConfigured() ? 'firebase' : 'supabase';
  }
  if (!isFirebaseConfigured()) return 'supabase';
  if (isSupabaseOAuthDegraded()) return 'firebase';

  invalidateSupabaseHealthCache();
  const oauthOk = await probeSupabaseOAuthReady(OAUTH_PROBE_MS);
  if (!oauthOk) {
    markSupabaseOAuthDegraded();
    return 'firebase';
  }
  return 'supabase';
}

export const SUPABASE_OAUTH_DOWN_MESSAGE =
  'Supabase sign-in is temporarily down. Using Google backup sign-in — your account will sync when Supabase recovers.';

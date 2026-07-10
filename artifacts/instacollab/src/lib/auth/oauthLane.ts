import type { AuthBackend } from './types';
import {
  invalidateSupabaseHealthCache,
  probeSupabaseOAuthReady,
} from './health';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';
import {
  clearSupabaseOAuthDegraded,
  isSupabaseOAuthDegraded,
  markSupabaseOAuthDegraded,
  resolveOAuthSignInBackend,
} from './providerState';

const OAUTH_PROBE_MS = 4_000;

/** Instant OAuth lane — no network probe on sign-in click. */
export function resolveLiveOAuthBackendSync(): AuthBackend {
  return resolveOAuthSignInBackend();
}

/**
 * Pick OAuth lane before any browser redirect.
 * When Firebase is configured, default to Firebase unless Supabase /authorize is healthy now.
 */
export async function resolveLiveOAuthBackend(): Promise<AuthBackend> {
  if (!isSupabaseConfigured()) {
    return isFirebaseConfigured() ? 'firebase' : 'supabase';
  }

  if (isSupabaseOAuthDegraded() && isFirebaseConfigured()) {
    return 'firebase';
  }

  if (!isFirebaseConfigured()) {
    return 'supabase';
  }

  invalidateSupabaseHealthCache();
  const oauthOk = await probeSupabaseOAuthReady(OAUTH_PROBE_MS);
  if (oauthOk) {
    clearSupabaseOAuthDegraded();
    return 'supabase';
  }

  markSupabaseOAuthDegraded();
  return 'firebase';
}

export async function isSupabaseOAuthRedirectAllowed(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (resolveLiveOAuthBackendSync() === 'firebase') return false;
  if (isSupabaseOAuthDegraded()) return false;
  invalidateSupabaseHealthCache();
  const oauthOk = await probeSupabaseOAuthReady(OAUTH_PROBE_MS);
  if (!oauthOk) {
    markSupabaseOAuthDegraded();
    return false;
  }
  clearSupabaseOAuthDegraded();
  return true;
}

export const SUPABASE_OAUTH_DOWN_MESSAGE =
  'Supabase sign-in is temporarily down. Using Google backup sign-in — your account will sync when Supabase recovers.';

export const SUPABASE_OAUTH_ONLY_DOWN_MESSAGE =
  'Google sign-in through Supabase is temporarily unavailable (server timeout). Try email login or wait a few minutes.';

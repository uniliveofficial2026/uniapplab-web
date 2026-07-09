import type { AuthBackend } from './types';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';

const PROVIDER_KEY = 'instacollab_auth_backend';
const PROVIDER_AT_KEY = 'instacollab_auth_backend_at';
/** OAuth redirect lane only — never blocks Supabase data/realtime/session restore. */
const OAUTH_DEGRADED_KEY = 'instacollab_supabase_oauth_degraded';
const LEGACY_UNHEALTHY_LS_KEY = 'instacollab_supabase_unhealthy';

const OAUTH_DEGRADED_TTL_MS = 5 * 60 * 1000;
const FIREBASE_OAUTH_PREFERENCE_TTL_MS = 15 * 60 * 1000;

let oauthDegradedUntilMs = 0;
let legacyPurged = false;

function session(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function local(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

/** Purge sticky localStorage flags from older builds before React paints. */
export function bootstrapSupabaseAuthState(): void {
  if (typeof window === 'undefined') return;

  const ls = local();
  ls?.removeItem(LEGACY_UNHEALTHY_LS_KEY);
  ls?.removeItem(PROVIDER_KEY);
  ls?.removeItem(PROVIDER_AT_KEY);

  legacyPurged = true;
  syncOAuthDegradedFromSession();
}

function syncOAuthDegradedFromSession(): void {
  const raw = session()?.getItem(OAUTH_DEGRADED_KEY);
  if (!raw) {
    oauthDegradedUntilMs = 0;
    return;
  }
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    session()?.removeItem(OAUTH_DEGRADED_KEY);
    oauthDegradedUntilMs = 0;
    return;
  }
  oauthDegradedUntilMs = until;
}

export function readStoredAuthBackend(): AuthBackend | null {
  const raw = session()?.getItem(PROVIDER_KEY);
  if (raw !== 'firebase' && raw !== 'supabase') return null;

  if (raw === 'firebase') {
    const at = Number(session()?.getItem(PROVIDER_AT_KEY));
    if (!Number.isFinite(at) || Date.now() - at > FIREBASE_OAUTH_PREFERENCE_TTL_MS) {
      session()?.removeItem(PROVIDER_KEY);
      session()?.removeItem(PROVIDER_AT_KEY);
      return null;
    }
  }

  return raw;
}

export function writeStoredAuthBackend(backend: AuthBackend): void {
  const s = session();
  if (!s) return;
  s.setItem(PROVIDER_KEY, backend);
  s.setItem(PROVIDER_AT_KEY, String(Date.now()));
}

export function markSupabaseOAuthDegraded(): void {
  if (!legacyPurged) bootstrapSupabaseAuthState();
  const until = Date.now() + OAUTH_DEGRADED_TTL_MS;
  oauthDegradedUntilMs = until;
  session()?.setItem(OAUTH_DEGRADED_KEY, String(until));
}

export function clearSupabaseOAuthDegraded(): void {
  oauthDegradedUntilMs = 0;
  session()?.removeItem(OAUTH_DEGRADED_KEY);
  local()?.removeItem(LEGACY_UNHEALTHY_LS_KEY);
}

export function isSupabaseOAuthDegraded(): boolean {
  if (!legacyPurged) bootstrapSupabaseAuthState();
  syncOAuthDegradedFromSession();
  return oauthDegradedUntilMs > Date.now();
}

/** Back-compat aliases — unhealthy now means OAuth redirect lane only. */
export function markSupabaseUnhealthy(): void {
  markSupabaseOAuthDegraded();
}

export function clearSupabaseUnhealthy(): void {
  clearSupabaseOAuthDegraded();
}

export function isSupabaseMarkedUnhealthy(): boolean {
  return isSupabaseOAuthDegraded();
}

/** App data, realtime, and session restore always use Supabase when configured. */
export function resolveInitialAuthBackend(): AuthBackend {
  if (isSupabaseConfigured()) return 'supabase';
  if (isFirebaseConfigured()) return 'firebase';
  return 'supabase';
}

/** Google/Apple redirect lane — Firebase when Supabase OAuth /authorize is down. */
export function resolveOAuthSignInBackend(): AuthBackend {
  if (isSupabaseOAuthDegraded() && isFirebaseConfigured()) return 'firebase';
  if (isSupabaseConfigured()) return 'supabase';
  if (isFirebaseConfigured()) return 'firebase';
  return 'supabase';
}

/**
 * Firebase is the active Google/Apple lane ONLY when Supabase OAuth can't be used:
 * either this is a Firebase-only env, or Supabase OAuth is currently degraded/unreachable.
 * Supabase stays primary by default so accounts land in the Supabase data backend.
 */
export function isFirebaseOAuthPrimaryMode(): boolean {
  if (!isFirebaseConfigured()) return false;
  if (!isSupabaseConfigured()) return true;
  return isSupabaseOAuthDegraded();
}

export function shouldPreferFirebaseOnStartup(): boolean {
  return false;
}

export function shouldPreferFirebaseForOAuth(): boolean {
  return resolveOAuthSignInBackend() === 'firebase';
}

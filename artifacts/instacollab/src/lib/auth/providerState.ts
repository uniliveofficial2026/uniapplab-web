import type { AuthBackend } from './types';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';

const PROVIDER_KEY = 'instacollab_auth_backend';
const PROVIDER_AT_KEY = 'instacollab_auth_backend_at';
/** OAuth + data lane — Firebase when Supabase auth/rest/oauth is down. */
const OAUTH_DEGRADED_KEY = 'instacollab_supabase_oauth_degraded';
const OAUTH_DEGRADED_LS_KEY = 'instacollab_supabase_oauth_degraded_until';
const LEGACY_UNHEALTHY_LS_KEY = 'instacollab_supabase_unhealthy';

const OAUTH_DEGRADED_TTL_MS = 6 * 60 * 60 * 1000;
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
  const fromSession = session()?.getItem(OAUTH_DEGRADED_KEY);
  const fromLocal = local()?.getItem(OAUTH_DEGRADED_LS_KEY);
  const raw = fromSession || fromLocal;
  if (!raw) {
    oauthDegradedUntilMs = 0;
    return;
  }
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    session()?.removeItem(OAUTH_DEGRADED_KEY);
    local()?.removeItem(OAUTH_DEGRADED_LS_KEY);
    oauthDegradedUntilMs = 0;
    return;
  }
  oauthDegradedUntilMs = until;
  if (fromLocal && !fromSession) {
    session()?.setItem(OAUTH_DEGRADED_KEY, String(until));
  }
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
  local()?.setItem(OAUTH_DEGRADED_LS_KEY, String(until));
}

export function clearSupabaseOAuthDegraded(): void {
  oauthDegradedUntilMs = 0;
  session()?.removeItem(OAUTH_DEGRADED_KEY);
  local()?.removeItem(OAUTH_DEGRADED_LS_KEY);
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

export function shouldPreferFirebaseOnStartup(): boolean {
  return false;
}

export function shouldPreferFirebaseForOAuth(): boolean {
  return resolveOAuthSignInBackend() === 'firebase';
}

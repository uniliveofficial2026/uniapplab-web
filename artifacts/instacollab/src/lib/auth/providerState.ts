import type { AuthBackend } from './types';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';

const PROVIDER_KEY = 'instacollab_auth_backend';
const UNHEALTHY_KEY = 'instacollab_supabase_unhealthy';
const UNHEALTHY_TTL_MS = 5 * 60 * 1000;

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function readStoredAuthBackend(): AuthBackend | null {
  const raw = storage()?.getItem(PROVIDER_KEY);
  return raw === 'firebase' || raw === 'supabase' ? raw : null;
}

export function writeStoredAuthBackend(backend: AuthBackend): void {
  storage()?.setItem(PROVIDER_KEY, backend);
}

export function markSupabaseUnhealthy(): void {
  const s = storage();
  if (!s) return;
  s.setItem(UNHEALTHY_KEY, String(Date.now()));
}

export function clearSupabaseUnhealthy(): void {
  storage()?.removeItem(UNHEALTHY_KEY);
}

export function isSupabaseMarkedUnhealthy(): boolean {
  const raw = storage()?.getItem(UNHEALTHY_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  if (Date.now() - at > UNHEALTHY_TTL_MS) {
    storage()?.removeItem(UNHEALTHY_KEY);
    return false;
  }
  return true;
}

/** Pick backend synchronously so Firebase can start immediately when Supabase was down. */
export function resolveInitialAuthBackend(): AuthBackend {
  const supabase = isSupabaseConfigured();
  const firebase = isFirebaseConfigured();
  if (supabase && !firebase) return 'supabase';
  if (firebase && !supabase) return 'firebase';
  if (!supabase && !firebase) return 'supabase';

  if (isSupabaseMarkedUnhealthy()) return 'firebase';
  const stored = readStoredAuthBackend();
  if (stored === 'firebase') return 'firebase';
  return 'supabase';
}

export function shouldPreferFirebaseOnStartup(): boolean {
  return resolveInitialAuthBackend() === 'firebase';
}

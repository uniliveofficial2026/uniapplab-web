import {
  GoogleAuthProvider,
  OAuthProvider,
  browserPopupRedirectResolver,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type AuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { AuthResult } from '../auth/types';
import { mapGoogleSignInConfigurationError } from '../auth/googleSignInErrorHints';
import { getFirebaseGoogleRedirectUri } from '../auth/googleOAuthSetup';
import { writeStoredAuthBackend } from '../auth/providerState';
import { isDevTunnelHostname } from '../auth/tunnelHost';
import type { ProfileRow } from '../supabase/types';
import { fetchFirebaseProfile, upsertFirebaseProfile } from './profile';

const REDIRECT_PENDING_KEY = 'instacollab_firebase_oauth_redirect';
const REDIRECT_PENDING_TTL_MS = 10 * 60 * 1000;

/** Popup is opt-in; redirect avoids many auth/invalid-action cases in dev / strict browsers. */
function usePopupOAuth(): boolean {
  return import.meta.env.VITE_FIREBASE_OAUTH_USE_POPUP === 'true';
}

function slugUsername(email: string | null | undefined, uid: string): string {
  const base = (email?.split('@')[0] || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (base.length >= 3) return base.slice(0, 24);
  return `user_${uid.replace(/-/g, '').slice(0, 8)}`;
}

function writeRedirectPendingTimestamp(): void {
  const value = String(Date.now());
  try {
    sessionStorage?.setItem(REDIRECT_PENDING_KEY, value);
  } catch {
    /* private mode */
  }
  try {
    localStorage?.setItem(REDIRECT_PENDING_KEY, value);
  } catch {
    /* private mode */
  }
}

export function markFirebaseOAuthRedirectPending(): void {
  if (typeof window === 'undefined') return;
  writeRedirectPendingTimestamp();
}

export function clearFirebaseOAuthRedirectPending(): void {
  try {
    sessionStorage?.removeItem(REDIRECT_PENDING_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage?.removeItem(REDIRECT_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function readRedirectPendingTimestamp(): number | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage?.getItem(REDIRECT_PENDING_KEY) ?? null;
  } catch {
    /* ignore */
  }
  if (!raw) {
    try {
      raw = localStorage?.getItem(REDIRECT_PENDING_KEY) ?? null;
    } catch {
      /* ignore */
    }
  }
  if (!raw) return null;
  const at = Number(raw);
  return Number.isFinite(at) ? at : null;
}

function isFirebaseOAuthRedirectPending(): boolean {
  const at = readRedirectPendingTimestamp();
  if (at === null) return false;
  if (Date.now() - at > REDIRECT_PENDING_TTL_MS) {
    clearFirebaseOAuthRedirectPending();
    return false;
  }
  return true;
}

/** Firebase redirect often lands with apiKey / access_token in the URL. */
export function hasFirebaseAuthCallbackInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const search = window.location.search;
  const hash = window.location.hash.replace(/^#/, '');
  if (/[?&]apiKey=/.test(search) || /[?&]apiKey=/.test(hash)) return true;
  if (/access_token=/.test(hash) || /id_token=/.test(hash)) return true;
  if (/type=signIn/.test(hash) || /type=signInViaRedirect/.test(hash)) return true;
  if (/[?&]error=/.test(search) && /auth/i.test(search)) return true;
  if (/[?&]error=/.test(hash)) return true;
  return false;
}

export function shouldCompleteFirebaseOAuthRedirect(): boolean {
  return isFirebaseOAuthRedirectPending() || hasFirebaseAuthCallbackInUrl();
}

/** Remove OAuth hash/query leftovers so getRedirectResult is not confused on the next load. */
export function stripOAuthParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  window.history.replaceState({}, document.title, path);
}

/** Shown under Google/Apple buttons so console setup matches the exact URL you use. */
export function getFirebaseOAuthSetupOrigin(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  return window.location.origin;
}

function oauthOriginHint(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  const origin = getFirebaseOAuthSetupOrigin();
  if (host === '127.0.0.1') {
    return ' Open the app at http://localhost:3000 (not 127.0.0.1) and add localhost under Firebase → Authentication → Authorized domains.';
  }
  if (isDevTunnelHostname(host)) {
    return (
      ` Add "${host}" to Firebase → Authorized domains and "${origin}" to Google Cloud → Web client → JavaScript origins.` +
      ' If you restarted npm run dev:public, the tunnel URL may have changed — update both consoles to match the new Public URL in the terminal.'
    );
  }
  return ` Add "${origin}" to Firebase → Authentication → Authorized domains and to Google Cloud → Credentials → Web client → Authorized JavaScript origins.`;
}

export function mapFirebaseOAuthError(code: string | undefined, message: string): string {
  const code11 = mapGoogleSignInConfigurationError(message, code);
  if (code11) return code11;
  const lower = message.toLowerCase();
  if (
    code === 'auth/invalid-action' ||
    lower.includes('requested action is invalid') ||
    lower.includes('invalid action')
  ) {
    return (
      'Sign-in could not complete (invalid OAuth action).' +
      oauthOriginHint() +
      ' In Google Cloud Console, use the Web client from the same Firebase project and add this origin under Authorized JavaScript origins.'
    );
  }
  if (code === 'auth/unauthorized-domain') {
    return (
      'This site is not authorized for Firebase sign-in.' + oauthOriginHint()
    );
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google or Apple sign-in is disabled. Enable it under Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email using a different sign-in method. Try email/password or the other provider.';
  }
  if (
    /redirect_uri_mismatch/i.test(message) ||
    /redirect_uri_mismatch/i.test(code || '')
  ) {
    return (
      'Google redirect_uri_mismatch — fix the Web OAuth client (not the tunnel URL in redirect URIs). ' +
      `In Google Cloud → Credentials → Web client, add Authorized redirect URI: ${getFirebaseGoogleRedirectUri()}. ` +
      `Put your app URL (${getFirebaseOAuthSetupOrigin()}) under JavaScript origins only.` +
      oauthOriginHint()
    );
  }
  if (/access blocked|access_denied|disallowed_useragent/i.test(message)) {
    return (
      'Google blocked the sign-in.' +
      oauthOriginHint() +
      ' Use the Firebase Web client in Google Cloud → Credentials (not the Android/iOS client).'
    );
  }
  return message || 'Sign-in failed.';
}

export async function ensureFirebaseProfileAfterOAuth(user: FirebaseUser): Promise<ProfileRow> {
  const existing = await fetchFirebaseProfile(user.uid).catch(() => null);
  if (existing) return existing;

  const username = slugUsername(user.email, user.uid);
  const now = new Date().toISOString();
  const row: ProfileRow = {
    id: user.uid,
    username,
    display_name: user.displayName?.trim() || username,
    avatar_url: user.photoURL,
    bio: '',
    profile_setup_complete: false,
    public_user_id: username,
    public_user_id_changed_at: now,
  };
  try {
    await upsertFirebaseProfile(row);
  } catch (err) {
    console.warn('[auth] Firestore profile upsert after OAuth failed (sign-in still OK):', err);
  }
  return row;
}

function preferRedirectFlow(): boolean {
  if (usePopupOAuth()) return false;
  if (import.meta.env.VITE_FIREBASE_OAUTH_USE_REDIRECT === 'true') return true;
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return false;
}

function isInvalidActionError(code: string | undefined, message: string): boolean {
  return (
    code === 'auth/invalid-action' ||
    /requested action is invalid/i.test(message) ||
    /invalid action/i.test(message)
  );
}

async function signInWithRedirectFlow(
  auth: Auth,
  provider: AuthProvider
): Promise<AuthResult> {
  writeStoredAuthBackend('firebase');
  markFirebaseOAuthRedirectPending();
  await signInWithRedirect(auth, provider);
  return { ok: true, redirecting: true };
}

async function signInWithOAuthProvider(
  auth: Auth,
  provider: AuthProvider
): Promise<AuthResult> {
  if (preferRedirectFlow()) {
    return signInWithRedirectFlow(auth, provider);
  }

  try {
    try {
      await signInWithPopup(auth, provider);
    } catch (popupErr: unknown) {
      const pe = popupErr as { code?: string; message?: string };
      if (
        pe.code === 'auth/popup-blocked' ||
        pe.code === 'auth/popup-blocked-by-browser' ||
        isInvalidActionError(pe.code, pe.message || '')
      ) {
        throw popupErr;
      }
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    }
    const user = auth.currentUser;
    if (user) await ensureFirebaseProfileAfterOAuth(user);
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    const message = e.message || '';

    if (e.code === 'auth/popup-closed-by-user') {
      return { ok: false, reason: 'Sign-in was cancelled.' };
    }

    if (
      e.code === 'auth/popup-blocked' ||
      e.code === 'auth/popup-blocked-by-browser' ||
      isInvalidActionError(e.code, message)
    ) {
      return signInWithRedirectFlow(auth, provider);
    }

    return { ok: false, reason: mapFirebaseOAuthError(e.code, message) };
  }
}

export async function firebaseSignInWithGooglePopup(auth: Auth): Promise<AuthResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithOAuthProvider(auth, provider);
}

export async function firebaseSignInWithApplePopup(auth: Auth): Promise<AuthResult> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  return signInWithOAuthProvider(auth, provider);
}

/**
 * Finish redirect sign-in — only when we started signInWithRedirect in this tab.
 * Avoids auth/invalid-action from calling getRedirectResult on every page load.
 */
const REDIRECT_RESULT_TIMEOUT_MS = 6_000;

function withRedirectTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Firebase redirect sign-in timed out'));
    }, REDIRECT_RESULT_TIMEOUT_MS);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

export async function completeFirebaseOAuthRedirect(auth: Auth): Promise<AuthResult | null> {
  if (!shouldCompleteFirebaseOAuthRedirect()) {
    return null;
  }

  try {
    const result = await withRedirectTimeout(getRedirectResult(auth));
    clearFirebaseOAuthRedirectPending();
    stripOAuthParamsFromUrl();

    const user = result?.user ?? auth.currentUser;
    if (!user) {
      return null;
    }

    await ensureFirebaseProfileAfterOAuth(user);
    return { ok: true };
  } catch (err: unknown) {
    clearFirebaseOAuthRedirectPending();
    stripOAuthParamsFromUrl();
    const e = err as { code?: string; message?: string };
    if (isInvalidActionError(e.code, e.message || '')) {
      return {
        ok: false,
        reason: mapFirebaseOAuthError(e.code, e.message || ''),
      };
    }
    return { ok: false, reason: mapFirebaseOAuthError(e.code, e.message || 'Redirect sign-in failed.') };
  }
}

import { completeSupabaseOAuthReturn, type SupabaseOAuthReturnResult } from './completeSupabaseOAuthReturn';
import { getFirebaseAuth } from '../firebase/app';
import { completeFirebaseOAuthRedirect } from '../firebase/oauth';
import type { AuthResult } from './types';
import {
  flushPendingNativeAuthDeepLink,
  peekPendingNativeAuthDeepLink,
} from './nativeAuthDeepLinkQueue';
import { isSupabaseOAuthReturnInUrl } from './supabaseOAuthReturn';

let inFlight: Promise<SupabaseOAuthReturnResult> | null = null;
let firebaseInFlight: Promise<AuthResult | null> | null = null;

/**
 * Single-flight Supabase OAuth return handling (AuthScreen + CloudAuthContext).
 * Also flushes Cap cold-start deep links queued before auth boot was ready.
 */
export function completeSupabaseOAuthReturnOnce(): Promise<SupabaseOAuthReturnResult> {
  if (!inFlight) {
    inFlight = (async () => {
      const applied = await flushPendingNativeAuthDeepLink();
      if (applied === 'navigate') {
        // location.replace in progress — hash/code exchange runs on next load / timeout.
        return { handled: true, ok: true, reason: 'native-deeplink-applied' };
      }
      if (applied === 'inline') {
        // Session already set; CloudAuthContext should continue restore/subscribe.
        return { handled: true, ok: true, reason: 'native-hash-session' };
      }
      if (!isSupabaseOAuthReturnInUrl() && !peekPendingNativeAuthDeepLink()) {
        return { handled: false, ok: false };
      }
      return completeSupabaseOAuthReturn();
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Single-flight Firebase OAuth redirect completion (backup lane). */
export function completeFirebaseOAuthRedirectOnce(): Promise<AuthResult | null> {
  if (!firebaseInFlight) {
    firebaseInFlight = (async () => {
      const auth = getFirebaseAuth();
      if (!auth) return null;
      return completeFirebaseOAuthRedirect(auth);
    })().finally(() => {
      firebaseInFlight = null;
    });
  }
  return firebaseInFlight;
}

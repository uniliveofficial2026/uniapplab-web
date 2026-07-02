/**
 * Unified cloud auth API — Supabase is the primary backend when configured.
 * Email, OAuth, sign-up, and password reset all flow through one module.
 */
import {
  supabaseRequestPasswordReset,
  supabaseResendSignupConfirmation,
  supabaseSendEmailOtp,
  supabaseSignIn,
  supabaseSignInWithApple,
  supabaseSignInWithGoogle,
  supabaseSignOut,
  supabaseSignUp,
  supabaseUpdatePassword,
  supabaseVerifyEmailOtp,
} from '../supabase/authApi';
import { isSupabaseConfigured } from '../supabase/config';
import {
  firebaseRequestPasswordReset,
  firebaseSignIn,
  firebaseSignInWithApple,
  firebaseSignInWithGoogle,
  firebaseSignOut,
  firebaseSignUp,
  firebaseUpdatePassword,
} from '../firebase/authApi';
import { isFirebaseConfigured } from '../firebase/config';
import { clearDevLocalAuthBypass } from './devLocalAuth';
import type { AuthResult } from './types';

export type { AuthResult } from './types';

function noCloud(): AuthResult {
  return { ok: false, reason: 'Cloud auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.' };
}

function isCredentialMismatch(reason: string): boolean {
  return /incorrect email|invalid login credentials/i.test(reason);
}

export async function authSignInWithEmail(email: string, password: string): Promise<AuthResult> {
  const trimmed = email.trim();
  if (isSupabaseConfigured()) {
    const supabaseResult = await supabaseSignIn(trimmed, password);
    if (supabaseResult.ok) {
      clearDevLocalAuthBypass();
      return supabaseResult;
    }
    if (isFirebaseConfigured() && isCredentialMismatch(supabaseResult.reason)) {
      const firebaseResult = await firebaseSignIn(trimmed, password);
      if (firebaseResult.ok) return firebaseResult;
    }
    return supabaseResult;
  }
  if (isFirebaseConfigured()) {
    return firebaseSignIn(trimmed, password);
  }
  return noCloud();
}

export async function authSignUp(payload: {
  email: string;
  password: string;
  username: string;
  displayName: string;
}): Promise<AuthResult & { needsEmailConfirmation?: boolean }> {
  if (isSupabaseConfigured()) {
    return supabaseSignUp(payload);
  }
  if (isFirebaseConfigured()) {
    return firebaseSignUp(payload);
  }
  return noCloud();
}

export async function authResendSignupConfirmation(email: string): Promise<AuthResult> {
  if (isSupabaseConfigured()) {
    return supabaseResendSignupConfirmation(email);
  }
  return { ok: false, reason: 'Email confirmation resend is only available with Supabase auth.' };
}

export async function authSendEmailOtp(
  email: string,
  options?: {
    shouldCreateUser?: boolean;
    username?: string;
    displayName?: string;
  },
): Promise<AuthResult> {
  if (isSupabaseConfigured()) {
    return supabaseSendEmailOtp(email, options);
  }
  return { ok: false, reason: 'Email OTP requires Supabase auth (VITE_SUPABASE_URL + anon key).' };
}

export async function authVerifyEmailOtp(
  email: string,
  code: string,
): Promise<AuthResult & { sessionApplied?: boolean }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: 'Email OTP requires Supabase auth.' };
  }
  const result = await supabaseVerifyEmailOtp(email, code);
  if (!result.ok) return result;
  return { ok: true, sessionApplied: Boolean(result.session) };
}

export async function authRequestPasswordReset(email: string): Promise<AuthResult> {
  if (isSupabaseConfigured()) {
    return supabaseRequestPasswordReset(email);
  }
  if (isFirebaseConfigured()) {
    return firebaseRequestPasswordReset(email);
  }
  return noCloud();
}

export async function authUpdatePassword(newPassword: string): Promise<AuthResult> {
  if (isSupabaseConfigured()) {
    return supabaseUpdatePassword(newPassword);
  }
  if (isFirebaseConfigured()) {
    return firebaseUpdatePassword(newPassword);
  }
  return noCloud();
}

export async function authSignInWithGoogle(options?: {
  selectAccount?: boolean;
  loginHint?: string;
}): Promise<AuthResult> {
  clearDevLocalAuthBypass();
  if (isSupabaseConfigured()) {
    await firebaseSignOut().catch(() => {});
    const result = await supabaseSignInWithGoogle(options);
    return result.ok ? { ok: true, redirecting: true } : result;
  }
  if (isFirebaseConfigured()) {
    await supabaseSignOut().catch(() => {});
    return firebaseSignInWithGoogle();
  }
  return noCloud();
}

export async function authSignInWithApple(): Promise<AuthResult> {
  clearDevLocalAuthBypass();
  if (isSupabaseConfigured()) {
    await firebaseSignOut().catch(() => {});
    const result = await supabaseSignInWithApple();
    return result.ok ? { ok: true, redirecting: true } : result;
  }
  if (isFirebaseConfigured()) {
    await supabaseSignOut().catch(() => {});
    return firebaseSignInWithApple();
  }
  return noCloud();
}

export async function authSignOut(options?: { keepDevBypass?: boolean }): Promise<void> {
  if (!options?.keepDevBypass) clearDevLocalAuthBypass();
  await Promise.allSettled([supabaseSignOut(), firebaseSignOut()]);
}

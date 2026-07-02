import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getAuthRedirectUrl } from '../auth/redirectUrl';
import { getSupabaseClient, getSupabaseClientAsync } from './client';
import { getSupabaseProjectRef } from './config';
import { ensureProfileFromSession } from './profile';
import {
  mapGoogleSignInConfigurationError,
  mapSupabaseAuthServiceError,
} from '../auth/googleSignInErrorHints';
import type { AuthResult } from '../auth/types';

function mapAuthError(message: string, code?: string): string {
  const upstream = mapSupabaseAuthServiceError(message);
  if (upstream) return upstream;
  const code11 = mapGoogleSignInConfigurationError(message, code);
  if (code11) return code11;
  if (/over_email_send_rate_limit|rate limit.*email|too many requests/i.test(message)) {
    return 'Wait 60 seconds before requesting another code.';
  }
  if (/otp.*expired|token.*expired|invalid.*otp|invalid.*token/i.test(message)) {
    return 'That code is invalid or expired. Tap Resend code and try again.';
  }
  if (/signups not allowed|user not found/i.test(message) && code === 'otp_disabled') {
    return 'Email OTP sign-in is disabled in Supabase. Enable Email provider and OTP template.';
  }
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email first (check your inbox), then log in.';
  }
  if (/user already registered/i.test(message)) return 'An account with this email already exists.';
  if (/password should be at least/i.test(message)) return 'Password must be at least 6 characters.';
  if (/signup is disabled/i.test(message)) {
    return 'Sign-up is disabled in Supabase. Enable email sign-up in Authentication → Providers.';
  }
  if (/database error saving new user/i.test(message)) {
    return 'Account could not be created. Run supabase/migrations/20260601120000_profiles.sql on your project.';
  }
  if (/redirect_uri_mismatch|redirect url|invalid.*redirect/i.test(message)) {
    return 'Google OAuth is not linked to this app yet. In Google Cloud, add the Supabase callback URL (run npm run oauth:setup). In Supabase → Authentication → URL Configuration, add this site URL.';
  }
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    const ref = getSupabaseProjectRef();
    const projectHint = ref
      ? ` Supabase project: ${ref} — open Dashboard → Authentication → Providers → Google.`
      : ' Enable Google in Supabase → Authentication → Providers.';
    return (
      'Google sign-in is not enabled for this Supabase project.' +
      projectHint +
      ' Toggle Google ON and paste your Google Cloud Web client ID + secret.' +
      ' On Vercel, confirm VITE_SUPABASE_URL matches the same project.'
    );
  }
  return message;
}

export async function supabaseSignIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase is not configured.' };
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  return { ok: true };
}

export async function supabaseSignUp(payload: {
  email: string;
  password: string;
  username: string;
  displayName: string;
}): Promise<AuthResult & { needsEmailConfirmation?: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase is not configured.' };
  const username = payload.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const { data, error } = await supabase.auth.signUp({
    email: payload.email.trim(),
    password: payload.password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        username,
        display_name: payload.displayName.trim() || username,
      },
    },
  });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  const needsEmailConfirmation = !data.session;
  if (data.session?.user) {
    const displayName = payload.displayName.trim() || username;
    await ensureProfileFromSession(data.session, {
      username,
      displayName,
      publicUserId: username,
    }).catch((profileErr) => {
      console.warn('[auth] profiles ensure after sign-up failed:', profileErr);
    });
  }
  return { ok: true, needsEmailConfirmation };
}

export async function supabaseRequestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase is not configured.' };
  const redirectTo = getAuthRedirectUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  return { ok: true };
}

/** Resend signup confirmation email (link, not OTP — check spam/promotions). */
export async function supabaseResendSignupConfirmation(email: string): Promise<AuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase is not configured.' };
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  return { ok: true };
}

/** Send a 6-digit email OTP (requires Supabase Magic Link template to use {{ .Token }}). */
export async function supabaseSendEmailOtp(
  email: string,
  options?: {
    shouldCreateUser?: boolean;
    username?: string;
    displayName?: string;
  },
): Promise<AuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase is not configured.' };
  const trimmed = email.trim();
  const username = options?.username?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const displayName = options?.displayName?.trim();
  const metadata: Record<string, string> = {};
  if (username) metadata.username = username;
  if (displayName) metadata.display_name = displayName;

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      shouldCreateUser: options?.shouldCreateUser ?? true,
      ...(Object.keys(metadata).length > 0 ? { data: metadata } : {}),
    },
  });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  return { ok: true };
}

/** Verify email OTP and return session when successful. */
export async function supabaseVerifyEmailOtp(
  email: string,
  token: string,
): Promise<AuthResult & { session?: Session | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase is not configured.' };
  const code = token.replace(/\D/g, '').trim();
  if (code.length < 6) {
    return { ok: false, reason: 'Enter the 6-digit code from your email.' };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code,
    type: 'email',
  });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  if (!data.session?.user) {
    return { ok: false, reason: 'That code is invalid or expired. Request a new code.' };
  }

  const meta = (data.session.user.user_metadata || {}) as Record<string, unknown>;
  const uname =
    (typeof meta.username === 'string' && meta.username) ||
    email.trim().split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
    'user';
  const dname =
    (typeof meta.display_name === 'string' && meta.display_name) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    uname;

  await ensureProfileFromSession(data.session, {
    username: uname,
    displayName: dname,
    publicUserId: uname,
  }).catch((profileErr) => {
    console.warn('[auth] profiles ensure after email OTP failed:', profileErr);
  });

  return { ok: true, session: data.session };
}

export async function supabaseUpdatePassword(newPassword: string): Promise<AuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase is not configured.' };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  return { ok: true };
}

async function supabaseSignInWithOAuthProvider(
  provider: 'google' | 'apple',
  options?: { scopes?: string; selectAccount?: boolean; loginHint?: string }
): Promise<AuthResult> {
  const supabase = await getSupabaseClientAsync();
  if (!supabase) return { ok: false, reason: 'Supabase is not configured.' };

  const queryParams: Record<string, string> = {};
  if (options?.selectAccount) queryParams.prompt = 'select_account';
  if (options?.loginHint?.trim()) queryParams.login_hint = options.loginHint.trim();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider === 'google' ? 'google' : 'apple',
    options: {
      redirectTo: getAuthRedirectUrl(),
      ...(options?.scopes ? { scopes: options.scopes } : {}),
      ...(Object.keys(queryParams).length > 0 ? { queryParams } : {}),
    },
  });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  return { ok: true, redirecting: true };
}

/** Opens Google OAuth (login or sign-up — same flow). Redirects away from the app. */
export function supabaseSignInWithGoogle(options?: {
  selectAccount?: boolean;
  loginHint?: string;
}): Promise<AuthResult> {
  return supabaseSignInWithOAuthProvider('google', options);
}

/** Opens Apple OAuth (login or sign-up). Requests name + email scopes on first sign-in. */
export function supabaseSignInWithApple(): Promise<AuthResult> {
  return supabaseSignInWithOAuthProvider('apple', { scopes: 'name email' });
}

export async function supabaseSignOut(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function subscribeToAuthChanges(
  handler: (event: AuthChangeEvent, session: Session | null) => void
) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    handler(event, session);
  });
  return () => data.subscription.unsubscribe();
}

export async function getInitialSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

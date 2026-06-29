import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getAuthRedirectUrl } from '../auth/redirectUrl';
import { getSupabaseClient } from './client';
import { ensureProfileFromSession } from './profile';
import { mapGoogleSignInConfigurationError } from '../auth/googleSignInErrorHints';

export type AuthResult = { ok: true } | { ok: false; reason: string };

function mapAuthError(message: string, code?: string): string {
  const code11 = mapGoogleSignInConfigurationError(message, code);
  if (code11) return code11;
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
    return 'Enable Google in Supabase → Authentication → Providers and paste your Google Web client ID + secret.';
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
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  return { ok: true };
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
  options?: { scopes?: string }
): Promise<AuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase is not configured.' };
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthRedirectUrl(),
      ...(options?.scopes ? { scopes: options.scopes } : {}),
    },
  });
  if (error) return { ok: false, reason: mapAuthError(error.message, error.code) };
  return { ok: true };
}

/** Opens Google OAuth (login or sign-up — same flow). Redirects away from the app. */
export function supabaseSignInWithGoogle(): Promise<AuthResult> {
  return supabaseSignInWithOAuthProvider('google');
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

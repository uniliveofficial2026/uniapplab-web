import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { mapGoogleSignInConfigurationError } from './googleSignInErrorHints';
import { safeDecodeOAuthError } from './safeDecodeOAuthError';
import { isSupabaseOAuthReturnInUrl, stripSupabaseOAuthParamsFromUrl } from './supabaseOAuthReturn';
import { markSupabaseOAuthDegraded, writeStoredAuthBackend } from './providerState';
import { withTimeout } from '../networkPolicy';

export type SupabaseOAuthReturnResult = {
  handled: boolean;
  ok: boolean;
  reason?: string;
};

const OAUTH_EXCHANGE_MS = 5_000;

/**
 * After Google/Apple redirect, Supabase client exchanges ?code= for a session.
 * Call early on load and after OAuth buttons return without redirecting.
 */
export async function completeSupabaseOAuthReturn(): Promise<SupabaseOAuthReturnResult> {
  if (!isSupabaseConfigured() || !isSupabaseOAuthReturnInUrl()) {
    return { handled: false, ok: false };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { handled: true, ok: false, reason: 'Supabase is not configured.' };
  }

  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get('error_description') || params.get('error');
  if (oauthError) {
    stripSupabaseOAuthParamsFromUrl();
    const decoded = safeDecodeOAuthError(oauthError);
    const mapped = mapGoogleSignInConfigurationError(decoded, params.get('error') || undefined);
    return {
      handled: true,
      ok: false,
      reason: mapped || decoded,
    };
  }

  try {
    const tokenHash = params.get('token_hash');
    const otpType = params.get('type');
    if (tokenHash && otpType) {
      const { data, error } = await withTimeout(
        supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType as 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change',
        }),
        OAUTH_EXCHANGE_MS,
        'Supabase verifyOtp',
      );
      if (error) {
        return { handled: true, ok: false, reason: error.message };
      }
      if (data.session?.user) {
        writeStoredAuthBackend('supabase');
        stripSupabaseOAuthParamsFromUrl();
        return { handled: true, ok: true };
      }
    }

    const code = params.get('code');
    if (code) {
      const { data, error } = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
        OAUTH_EXCHANGE_MS,
        'Supabase exchangeCodeForSession',
      );
      if (error) {
        const mapped = mapGoogleSignInConfigurationError(error.message, String(error.status ?? ''));
        return { handled: true, ok: false, reason: mapped || error.message };
      }
      if (data.session?.user) {
        writeStoredAuthBackend('supabase');
        stripSupabaseOAuthParamsFromUrl();
        return { handled: true, ok: true };
      }
    }

    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      OAUTH_EXCHANGE_MS,
      'Supabase getSession',
    );
    if (error) {
      const mapped = mapGoogleSignInConfigurationError(error.message, String(error.status ?? ''));
      return { handled: true, ok: false, reason: mapped || error.message };
    }
    if (data.session?.user) {
      writeStoredAuthBackend('supabase');
      stripSupabaseOAuthParamsFromUrl();
      return { handled: true, ok: true };
    }
    return {
      handled: true,
      ok: false,
      reason:
        'Google sign-in returned but no session was created. Add this site URL in Supabase → Authentication → URL Configuration, then try again.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth session failed';
    if (/timed out|timeout|522|524|failed to fetch|network/i.test(message)) {
      markSupabaseOAuthDegraded();
    }
    return { handled: true, ok: false, reason: message };
  }
}

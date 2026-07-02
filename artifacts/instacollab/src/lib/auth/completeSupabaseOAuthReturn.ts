import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { mapGoogleSignInConfigurationError } from './googleSignInErrorHints';
import { safeDecodeOAuthError } from './safeDecodeOAuthError';
import { isSupabaseOAuthReturnInUrl, stripSupabaseOAuthParamsFromUrl } from './supabaseOAuthReturn';
import { writeStoredAuthBackend } from './providerState';

export type SupabaseOAuthReturnResult = {
  handled: boolean;
  ok: boolean;
  reason?: string;
};

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
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType as 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change',
      });
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
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
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

    const { data, error } = await supabase.auth.getSession();
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
    return { handled: true, ok: false, reason: message };
  }
}

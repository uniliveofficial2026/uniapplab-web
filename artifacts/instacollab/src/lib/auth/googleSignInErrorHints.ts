import { getConfiguredAppOrigin } from './redirectUrl';
import { getSupabaseGoogleRedirectUri } from './googleOAuthSetup';

/** Google Sign-In / Identity Platform often surfaces misconfiguration as "code 11". */
export function formatGoogleSignInCode11Hint(origin?: string): string {
  const site = origin || getConfiguredAppOrigin();
  const supabaseCallback = getSupabaseGoogleRedirectUri();
  return (
    'Google sign-in failed (code 11 — configuration). ' +
    `In Google Cloud → Credentials → Web client: add redirect URI ${supabaseCallback} ` +
    `(not the tunnel URL). Add ${site} under JavaScript origins only. ` +
    'In Supabase → Authentication → Providers → Google: enable and paste the same Web client ID + secret. ' +
    `Also add ${site} under Supabase → URL Configuration.`
  );
}

export function isGoogleSignInCode11Message(message: string, code?: string): boolean {
  const text = `${code || ''} ${message}`.toLowerCase();
  return (
    /\bcode\s*['"]?11['"]?\b/.test(text) ||
    /\b(error\s*)?11\b/.test(text) ||
    /developer.?error/.test(text) ||
    /statuscode\s*[:=]?\s*11/.test(text)
  );
}

export function mapGoogleSignInConfigurationError(message: string, code?: string): string | null {
  if (!isGoogleSignInCode11Message(message, code)) return null;
  return formatGoogleSignInCode11Hint();
}

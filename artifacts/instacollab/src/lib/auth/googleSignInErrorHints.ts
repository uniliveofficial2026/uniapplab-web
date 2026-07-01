import { getConfiguredAppOrigin } from './redirectUrl';
import { getSupabaseGoogleRedirectUri } from './googleOAuthSetup';
import { getSupabaseProjectRef } from '../supabase/config';

/** Envoy/Cloudflare text when Supabase Auth upstream is down (not Google OAuth config). */
export function isSupabaseAuthUpstreamError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes('upstream connect error') ||
    text.includes('delayed connect error') ||
    text.includes('transport failure reason') ||
    (text.includes('connection failure') && text.includes('111'))
  );
}

export function formatSupabaseAuthUpstreamHint(): string {
  const ref = getSupabaseProjectRef();
  const project = ref ? `project ${ref}` : 'your Supabase project';
  return (
    `Supabase Auth is unreachable (connection refused). This is not caused by uniapplab.com DNS or Google redirect settings. ` +
    `Open Supabase Dashboard → ${project} → if status is Paused, click Restore and wait 1–2 minutes. ` +
    'Then retry Google sign-in. If it persists, check status.supabase.com and Supabase → Logs → Auth.'
  );
}

export function mapSupabaseAuthServiceError(message: string): string | null {
  if (!isSupabaseAuthUpstreamError(message)) return null;
  return formatSupabaseAuthUpstreamHint();
}

/** Google Sign-In / Identity Platform often surfaces misconfiguration as "code 11". */
export function formatGoogleSignInCode11Hint(origin?: string): string {
  const site = origin || getConfiguredAppOrigin();
  const supabaseCallback = getSupabaseGoogleRedirectUri();
  return (
    'Google sign-in failed (code 11 — configuration). ' +
    `In Google Cloud → Credentials → Web client: add redirect URI ${supabaseCallback} ` +
    `(not the tunnel URL). Add ${site} and https://app.uniapplab.com under JavaScript origins. ` +
    'In Supabase → Authentication → Providers → Google: enable and paste the same Web client ID + secret. ' +
    `Set Supabase Site URL to https://app.uniapplab.com and add ${site}/** under Redirect URLs.`
  );
}

export function isGoogleSignInCode11Message(message: string, code?: string): boolean {
  if (isSupabaseAuthUpstreamError(message)) return false;
  const text = `${code || ''} ${message}`.toLowerCase();
  return (
    /\bcode\s*['"]?11['"]?\b/.test(text) ||
    /\bgoogle.*\b11\b/.test(text) ||
    /developer.?error/.test(text) ||
    /statuscode\s*[:=]?\s*11/.test(text)
  );
}

export function mapGoogleSignInConfigurationError(message: string, code?: string): string | null {
  if (!isGoogleSignInCode11Message(message, code)) return null;
  return formatGoogleSignInCode11Hint();
}

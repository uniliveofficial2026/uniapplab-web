import { getFirebaseAuthDomain } from '../firebase/config';

/** Redirect URI Google expects for Firebase Auth (not your tunnel URL). */
export function getFirebaseGoogleRedirectUri(): string {
  const domain = getFirebaseAuthDomain() || 'uchat-app-c1b8e.firebaseapp.com';
  const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${host}/__/auth/handler`;
}

export function getSupabaseGoogleRedirectUri(): string {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  if (!url) return 'https://YOUR-PROJECT.supabase.co/auth/v1/callback';
  return `${url}/auth/v1/callback`;
}

export type GoogleOAuthUrlError = {
  code: string;
  description: string;
};

/** Google OAuth errors land in hash or query before Firebase processes them. */
export function readGoogleOAuthUrlError(): GoogleOAuthUrlError | null {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);
  const code = hash.get('error') || search.get('error');
  if (!code) return null;
  const description =
    hash.get('error_description') || search.get('error_description') || code;
  return { code, description: decodeURIComponent(description.replace(/\+/g, ' ')) };
}

export function formatGoogleOAuthUrlError(err: GoogleOAuthUrlError): string {
  const lower = `${err.code} ${err.description}`.toLowerCase();
  if (lower.includes('redirect_uri_mismatch')) {
    const firebaseUri = getFirebaseGoogleRedirectUri();
    const supabaseUri = getSupabaseGoogleRedirectUri();
    return (
      'Google redirect_uri_mismatch: the OAuth Web client is missing the correct redirect URI. ' +
      'Open Google Cloud → APIs & Services → Credentials → Web client (from Firebase → Authentication → Google → Web SDK configuration). ' +
      `Add Authorized redirect URI: ${firebaseUri} ` +
      `(do not use your trycloudflare URL there). ` +
      `If you ever use Supabase Google OAuth, also add: ${supabaseUri}. ` +
      'Add your app origin under Authorized JavaScript origins only (e.g. your tunnel https URL).'
    );
  }
  if (
    lower.includes('access_denied') ||
    lower.includes('access blocked') ||
    lower.includes('invalid') && lower.includes('request')
  ) {
    return (
      `Google blocked sign-in: ${err.description}. ` +
      'Check OAuth consent screen (Testing → add your Gmail as Test user) and API key HTTP referrers for your tunnel URL.'
    );
  }
  return `Google sign-in error (${err.code}): ${err.description}`;
}

export function isFirebaseAuthDomainMisconfigured(): boolean {
  const domain = getFirebaseAuthDomain().toLowerCase();
  if (!domain) return true;
  if (domain.includes('trycloudflare.com') || domain.includes('localhost')) {
    return true;
  }
  return !domain.includes('firebaseapp.com') && !domain.includes('web.app');
}

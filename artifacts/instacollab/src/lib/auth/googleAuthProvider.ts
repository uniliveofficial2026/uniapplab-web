import { GoogleAuthProvider } from 'firebase/auth';

/** Sign-in only — openid/email/profile. Avoids Google “unverified app” for sensitive APIs. */
export const GOOGLE_SIGNIN_SCOPES = ['openid', 'email', 'profile'] as const;

export const GOOGLE_SIGNIN_SCOPES_PARAM = GOOGLE_SIGNIN_SCOPES.join(' ');

/**
 * Google Workspace + YouTube Live scopes used by Admin Panel / Workspace surfaces.
 * These are sensitive/restricted — request only via incremental connect, never on login,
 * until the OAuth consent screen is Google-verified.
 */
export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/documents',
  /** Official YouTube Live chat send (liveChatMessages.insert) — stays in-app via API. */
  'https://www.googleapis.com/auth/youtube.force-ssl',
] as const;

/** Space-delimited scopes for Supabase `signInWithOAuth({ scopes })`. */
export const GOOGLE_WORKSPACE_SCOPES_PARAM = GOOGLE_WORKSPACE_SCOPES.join(' ');

/** Sanitize OAuth login_hint — never pass literal "undefined"/"null". */
export function sanitizeGoogleLoginHint(hint?: string | null): string | undefined {
  if (typeof hint !== 'string') return undefined;
  const trimmed = hint.trim();
  if (!trimmed) return undefined;
  if (/^(undefined|null|nan)$/i.test(trimmed)) return undefined;
  return trimmed;
}

/** Basic Google provider for Continue with Google (no Workspace APIs). */
export function createBasicGoogleAuthProvider(options?: {
  selectAccount?: boolean;
}): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  if (options?.selectAccount) {
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  return provider;
}

/** Google provider with workspace scopes + account picker (Admin Panel connect only). */
export function createWorkspaceGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account', access_type: 'offline' });
  for (const scope of GOOGLE_WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  return provider;
}

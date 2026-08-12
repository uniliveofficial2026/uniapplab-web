/**
 * Auth React context + hooks — no Firebase/Supabase SDK imports (safe for App entry).
 */
import React, { createContext, useContext } from 'react';
import type { AuthSdkUser } from './authSdkUser';
import type { StoredDeviceAccount } from './deviceAccounts';

export type AuthContextValue = {
  user: AuthSdkUser | null;
  profile: any | null;
  setProfile: React.Dispatch<React.SetStateAction<any | null>>;
  loading: boolean;
  userAccounts: StoredDeviceAccount[];
  googleAccessToken: string | null;
  loginWithGoogle: () => Promise<{ ok: boolean; reason?: string; redirecting?: boolean }>;
  /** Incremental Google Workspace API consent (Admin Panel). Not used for Continue with Google. */
  connectGoogleWorkspace: () => Promise<{ ok: boolean; reason?: string; redirecting?: boolean }>;
  loginWithApple: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  signupWithEmail: (e: string, p: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  switchAccount: () => Promise<{ ok: boolean; reason?: string; redirecting?: boolean }>;
  linkGoogleAccount: () => Promise<{ ok: boolean; reason?: string; redirecting?: boolean }>;
  linkEmailAccount: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; reason?: string; needsEmailConfirmation?: boolean }>;
  linkEmailSignUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ ok: boolean; reason?: string; needsEmailConfirmation?: boolean }>;
  resendEmailConfirmation: (email: string) => Promise<{ ok: boolean; reason?: string }>;
  sendEmailAuthOtp: (
    email: string,
    options?: { createAccount?: boolean; displayName?: string; username?: string },
  ) => Promise<{ ok: boolean; reason?: string }>;
  verifyEmailAuthOtp: (
    email: string,
    code: string,
    options?: { switchAccount?: boolean },
  ) => Promise<{ ok: boolean; reason?: string }>;
  deleteAccount: () => Promise<void>;
  selectAccount: (uid: string, password?: string) => Promise<void>;
  removeAccount: (uid: string) => void;
  ensureDeviceAccountsSynced: () => Promise<void>;
  refreshAccountSwitcher: () => Promise<void>;
};

/** Offline-safe fallback when provider has not hydrated yet. */
export const AUTH_OFFLINE_STUB: AuthContextValue = {
  user: null,
  profile: null,
  setProfile: () => {},
  loading: false,
  userAccounts: [],
  googleAccessToken: null,
  loginWithGoogle: async () => ({ ok: false, reason: 'Auth unavailable' }),
  connectGoogleWorkspace: async () => ({ ok: false, reason: 'Auth unavailable' }),
  loginWithApple: async () => {},
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
  switchAccount: async () => ({ ok: false, reason: 'Auth unavailable' }),
  linkGoogleAccount: async () => ({ ok: false, reason: 'Auth unavailable' }),
  linkEmailAccount: async () => ({ ok: false, reason: 'Auth unavailable' }),
  linkEmailSignUp: async () => ({ ok: false, reason: 'Auth unavailable' }),
  resendEmailConfirmation: async () => ({ ok: false, reason: 'Auth unavailable' }),
  sendEmailAuthOtp: async () => ({ ok: false, reason: 'Auth unavailable' }),
  verifyEmailAuthOtp: async () => ({ ok: false, reason: 'Auth unavailable' }),
  deleteAccount: async () => {},
  selectAccount: async () => {},
  removeAccount: () => {},
  ensureDeviceAccountsSynced: async () => {},
  refreshAccountSwitcher: async () => {},
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let warnedMissingAuthProvider = false;

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    if (!warnedMissingAuthProvider) {
      warnedMissingAuthProvider = true;
      console.warn(
        '[auth] useAuth called without AuthProvider context — using offline stub. Hard refresh if this persists.',
      );
    }
    return AUTH_OFFLINE_STUB;
  }
  return context;
}

export function useAuthOptional(): AuthContextValue | null {
  const context = useContext(AuthContext);
  return context ?? null;
}

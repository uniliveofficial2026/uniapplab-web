/**
 * Cloud auth context + hooks — no Firebase SDK value imports (safe for App entry).
 */
import React, { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AuthBackend } from '../lib/auth/types';
import { isCloudAuthConfigured } from '../lib/auth/config';
import { isSupabaseConfigured } from '../lib/supabase/config';

export type CloudAuthContextValue = {
  configured: boolean;
  authReady: boolean;
  activeBackend: AuthBackend | null;
  session: Session | null;
  recoveryMode: boolean;
  clearRecoveryMode: () => void;
  signOut: () => Promise<void>;
};

export const CloudAuthContext = createContext<CloudAuthContextValue>({
  configured: false,
  authReady: true,
  activeBackend: null,
  session: null,
  recoveryMode: false,
  clearRecoveryMode: () => {},
  signOut: async () => {},
});

export function useCloudAuth() {
  return useContext(CloudAuthContext);
}

/** Default configured hint before provider hydrates (Supabase-primary apps). */
export function getCloudAuthBootDefaults(): CloudAuthContextValue {
  const configured = isCloudAuthConfigured();
  return {
    configured,
    authReady: !configured,
    activeBackend: configured && isSupabaseConfigured() ? 'supabase' : configured ? 'firebase' : null,
    session: null,
    recoveryMode: false,
    clearRecoveryMode: () => {},
    signOut: async () => {},
  };
}

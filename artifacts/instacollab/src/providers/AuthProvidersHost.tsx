/**
 * Boot-safe auth providers host — children paint immediately; Firebase-capable
 * providers load in an async chunk (not on the critical entry graph).
 *
 * Until the real AuthProvider mounts, wrap with AuthContext so `useAuth()` does
 * not fall into the undefined-context offline stub (which breaks production login).
 */
import React, { useEffect, useState } from 'react';
import { AuthContext, AUTH_OFFLINE_STUB, type AuthContextValue } from '../lib/auth/authContextStore';

type Bundle = {
  CloudAuthProvider: React.ComponentType<{ children: React.ReactNode }>;
  AuthProvider: React.ComponentType<{ children: React.ReactNode }>;
};

const AUTH_BOOT_STUB: AuthContextValue = {
  ...AUTH_OFFLINE_STUB,
  loading: true,
  loginWithGoogle: async () => ({ ok: false, reason: 'Auth still loading' }),
  connectGoogleWorkspace: async () => ({ ok: false, reason: 'Auth still loading' }),
  switchAccount: async () => ({ ok: false, reason: 'Auth still loading' }),
  linkGoogleAccount: async () => ({ ok: false, reason: 'Auth still loading' }),
  linkEmailAccount: async () => ({ ok: false, reason: 'Auth still loading' }),
  linkEmailSignUp: async () => ({ ok: false, reason: 'Auth still loading' }),
  resendEmailConfirmation: async () => ({ ok: false, reason: 'Auth still loading' }),
  sendEmailAuthOtp: async () => ({ ok: false, reason: 'Auth still loading' }),
  verifyEmailAuthOtp: async () => ({ ok: false, reason: 'Auth still loading' }),
};

export function AuthProvidersHost({ children }: { children: React.ReactNode }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('./authProvidersBundle')
      .then((m) => {
        if (!cancelled) {
          setBundle({
            CloudAuthProvider: m.CloudAuthProvider,
            AuthProvider: m.AuthProvider,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bundle) {
    return (
      <AuthContext.Provider value={AUTH_BOOT_STUB}>
        {children}
        {loadError ? (
          <div
            role="alert"
            style={{
              position: 'fixed',
              left: 12,
              right: 12,
              bottom: 12,
              zIndex: 100000,
              padding: 12,
              borderRadius: 12,
              background: '#7f1d1d',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Auth failed to load. Refresh and try again.
          </div>
        ) : null}
      </AuthContext.Provider>
    );
  }

  const { CloudAuthProvider, AuthProvider } = bundle;
  return (
    <CloudAuthProvider>
      <AuthProvider>{children}</AuthProvider>
    </CloudAuthProvider>
  );
}

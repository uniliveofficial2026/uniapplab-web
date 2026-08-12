/**
 * Boot-safe auth providers host — children paint immediately; Firebase-capable
 * providers load in an async chunk (not on the critical entry graph).
 */
import React, { useEffect, useState } from 'react';

type Bundle = {
  CloudAuthProvider: React.ComponentType<{ children: React.ReactNode }>;
  AuthProvider: React.ComponentType<{ children: React.ReactNode }>;
};

export function AuthProvidersHost({ children }: { children: React.ReactNode }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('./authProvidersBundle').then((m) => {
      if (!cancelled) {
        setBundle({
          CloudAuthProvider: m.CloudAuthProvider,
          AuthProvider: m.AuthProvider,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bundle) {
    return <>{children}</>;
  }

  const { CloudAuthProvider, AuthProvider } = bundle;
  return (
    <CloudAuthProvider>
      <AuthProvider>{children}</AuthProvider>
    </CloudAuthProvider>
  );
}

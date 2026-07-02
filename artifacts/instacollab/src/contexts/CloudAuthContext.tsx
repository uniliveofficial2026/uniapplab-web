import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/db/localDb';
import { isCloudAuthConfigured } from '../lib/auth/config';
import type { AuthBackend } from '../lib/auth/types';
import { authSignOut } from '../lib/auth/authService';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { isFirebaseConfigured } from '../lib/firebase/config';
import { getFirebaseAuth } from '../lib/firebase/app';
import { fetchFirebaseProfile, userFromFirebaseUser } from '../lib/firebase/profile';
import { withTimeout } from '../lib/supabase/withTimeout';
import { completeSupabaseOAuthReturnOnce } from '../lib/auth/oauthReturnGuard';
import { isSupabaseOAuthReturnInUrl } from '../lib/auth/supabaseOAuthReturn';
import {
  applySupabaseSessionToLocalDb,
  restoreSupabaseSession,
  subscribeSupabaseAuthChanges,
  teardownCloudSession,
} from '../lib/auth/sessionManager';
import { startCloudAppStateRealtime } from '../lib/auth/cloudAppState';
import { isDevLocalAuthBypass } from '../lib/auth/devLocalAuth';
import { isNetworkOnline } from '../lib/networkStatus';
import { writeStoredAuthBackend } from '../lib/auth/providerState';
import {
  applyDevSessionOverrideFromUrl,
  shouldApplyDevSessionOverride,
} from '../lib/devSessionUser';
import { clearActiveDeviceUid, syncDeviceAccountForAppUser } from '../lib/auth/deviceAccounts';
import { bootstrapCloudSystemsAfterAuth } from '../lib/appCloudSystems';

const STARTUP_TIMEOUT_MS = 8_000;
const OFFLINE_STARTUP_TIMEOUT_MS = 400;
const SESSION_MS = 12_000;
const DB_READY_MS = 8_000;

type CloudAuthContextValue = {
  configured: boolean;
  authReady: boolean;
  activeBackend: AuthBackend | null;
  session: Session | null;
  recoveryMode: boolean;
  clearRecoveryMode: () => void;
  signOut: () => Promise<void>;
};

const CloudAuthContext = createContext<CloudAuthContextValue>({
  configured: false,
  authReady: true,
  activeBackend: null,
  session: null,
  recoveryMode: false,
  clearRecoveryMode: () => {},
  signOut: async () => {},
});

async function applyLegacyFirebaseUser(user: FirebaseUser | null) {
  await withTimeout(db.whenStorageReady(), DB_READY_MS, 'Local storage');
  if (!user) {
    if (isDevLocalAuthBypass() && db.isLoggedIn) return;
    teardownCloudSession();
    db.logout();
    return;
  }
  const profile = await withTimeout(
    fetchFirebaseProfile(user.uid),
    SESSION_MS,
    'Profile fetch'
  ).catch(() => null);
  const appUser = userFromFirebaseUser(user, profile);
  db.syncAuthUser(appUser);
  syncDeviceAccountForAppUser(appUser);
  db.advanceLaunchProgressAfterLogin(Boolean(profile?.profile_setup_complete));
  writeStoredAuthBackend('firebase');
  void startCloudAppStateRealtime(appUser.id);
}

export function CloudAuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isCloudAuthConfigured();
  const [authReady, setAuthReady] = useState(!configured);
  const [activeBackend, setActiveBackend] = useState<AuthBackend | null>(() =>
    configured && isSupabaseConfigured() ? 'supabase' : configured ? 'firebase' : null
  );
  const [session, setSession] = useState<Session | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const applyGeneration = useRef(0);

  const applySupabaseSessionSafe = useCallback(async (next: Session | null) => {
    const generation = ++applyGeneration.current;
    try {
      await applySupabaseSessionToLocalDb(next);
    } catch (err) {
      if (generation === applyGeneration.current) {
        console.warn('[auth] session apply failed:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!configured) return;

    let cancelled = false;
    let unsubAuth: (() => void) | undefined;
    let unsubFirebase: (() => void) | undefined;

    const markReady = () => {
      if (!cancelled) {
        setAuthReady(true);
        bootstrapCloudSystemsAfterAuth();
      }
    };

    const offlineAtBoot = typeof navigator !== 'undefined' && !navigator.onLine;
    const startupTimer = window.setTimeout(
      markReady,
      offlineAtBoot ? OFFLINE_STARTUP_TIMEOUT_MS : STARTUP_TIMEOUT_MS,
    );

    void db.whenStorageReady().then(() => {
      if (!cancelled && db.isLoggedIn) markReady();
    });

    const startSupabase = () => {
      setActiveBackend('supabase');
      writeStoredAuthBackend('supabase');

      if (import.meta.env.DEV && shouldApplyDevSessionOverride(window.location.search)) {
        void applyDevSessionOverrideFromUrl().finally(markReady);
        return;
      }

      void (async () => {
        try {
          if (!isNetworkOnline()) {
            if (db.isLoggedIn) {
              markReady();
            }
            return;
          }
          const restored = await withTimeout(
            restoreSupabaseSession(),
            SESSION_MS,
            'Supabase getSession'
          );
          if (cancelled) return;
          setSession(restored);
          if (restored) {
            await applySupabaseSessionSafe(restored);
          }
        } catch (err) {
          console.warn('[auth] Supabase restore failed:', err);
        } finally {
          markReady();
        }
      })();

      unsubAuth = subscribeSupabaseAuthChanges({
        onRecovery: () => setRecoveryMode(true),
        onSession: (next) => {
          if (cancelled) return;
          if (isDevLocalAuthBypass()) return;
          setSession(next);
          void applySupabaseSessionSafe(next).finally(markReady);
        },
      });
    };

    const startFirebaseOnly = () => {
      const auth = getFirebaseAuth();
      if (!auth) {
        markReady();
        return;
      }
      setActiveBackend('firebase');
      writeStoredAuthBackend('firebase');

      void (async () => {
        await auth.authStateReady();
        if (cancelled) return;

        unsubFirebase = onAuthStateChanged(auth, (user) => {
          if (cancelled) return;
          setSession(null);
          markReady();
          if (!user) {
            void applyLegacyFirebaseUser(null);
            return;
          }
          void applyLegacyFirebaseUser(user);
        });

        void applyLegacyFirebaseUser(auth.currentUser);
        markReady();
      })();
    };

    void (async () => {
      try {
        if (isSupabaseOAuthReturnInUrl() && isSupabaseConfigured()) {
          const oauthReturn = await completeSupabaseOAuthReturnOnce();
          if (oauthReturn.handled && !oauthReturn.ok && oauthReturn.reason) {
            window.dispatchEvent(
              new CustomEvent('app-toast', { detail: oauthReturn.reason })
            );
          }
        }

        if (isSupabaseConfigured()) {
          startSupabase();
          return;
        }

        if (isFirebaseConfigured()) {
          startFirebaseOnly();
          return;
        }
      } catch (err) {
        console.warn('[auth] startup failed:', err);
      } finally {
        markReady();
      }
    })();

    return () => {
      cancelled = true;
      applyGeneration.current += 1;
      window.clearTimeout(startupTimer);
      unsubAuth?.();
      unsubFirebase?.();
      teardownCloudSession();
    };
  }, [configured, applySupabaseSessionSafe]);

  const signOut = useCallback(async () => {
    applyGeneration.current += 1;
    if (configured) {
      try {
        await authSignOut();
      } catch (err) {
        console.warn('[auth] signOut failed:', err);
      }
    }
    clearActiveDeviceUid();
    teardownCloudSession();
    db.logoutSession();
    setSession(null);
  }, [configured]);

  const value = useMemo(
    () => ({
      configured,
      authReady,
      activeBackend,
      session,
      recoveryMode,
      clearRecoveryMode: () => setRecoveryMode(false),
      signOut,
    }),
    [configured, authReady, activeBackend, session, recoveryMode, signOut]
  );

  return <CloudAuthContext.Provider value={value}>{children}</CloudAuthContext.Provider>;
}

export function useCloudAuth() {
  return useContext(CloudAuthContext);
}

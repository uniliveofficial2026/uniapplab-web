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
import {
  completeSupabaseOAuthReturnOnce,
  completeFirebaseOAuthRedirectOnce,
} from '../lib/auth/oauthReturnGuard';
import { isSupabaseOAuthReturnInUrl } from '../lib/auth/supabaseOAuthReturn';
import { shouldCompleteFirebaseOAuthRedirect } from '../lib/firebase/oauth';
import {
  applySupabaseSessionToLocalDb,
  restoreSupabaseSession,
  subscribeSupabaseAuthChanges,
  teardownCloudSession,
} from '../lib/auth/sessionManager';
import { startCloudAppStateRealtime } from '../lib/auth/cloudAppState';
import { isDevLocalAuthBypass } from '../lib/auth/devLocalAuth';
import { isNetworkOnline } from '../lib/networkStatus';
import { applyFirebaseOAuthSessionToLocalDb } from '../lib/auth/applyFirebaseBackupSession';
import {
  isSupabaseOAuthDegraded,
  readStoredAuthBackend,
  writeStoredAuthBackend,
} from '../lib/auth/providerState';
import { readFirebaseBackupLink } from '../lib/auth/firebaseBackupLink';
import {
  applyDevSessionOverrideFromUrl,
  shouldApplyDevSessionOverride,
} from '../lib/devSessionUser';
import { clearActiveDeviceUid, syncDeviceAccountForAppUser } from '../lib/auth/deviceAccounts';
import { bootstrapCloudSystemsAfterAuth } from '../lib/appCloudSystems';

const SESSION_MS = 2_500;
const DB_READY_MS = 2_000;
const OAUTH_RETURN_MS = 5_000;

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

async function applyLegacyFirebaseUser(
  user: FirebaseUser | null,
  options?: { silent?: boolean },
) {
  await withTimeout(db.whenStorageReady(), DB_READY_MS, 'Local storage');
  if (!user) {
    if (isDevLocalAuthBypass() && db.isLoggedIn) return;
    if (isSupabaseConfigured() && db.isLoggedIn) return;
    teardownCloudSession();
    db.logout();
    return;
  }
  if (isSupabaseConfigured()) {
    const silent = options?.silent ?? db.isLoggedIn;
    await applyFirebaseOAuthSessionToLocalDb(user, { silent });
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

    let readyOnce = false;
    const markReady = () => {
      if (cancelled || readyOnce) return;
      readyOnce = true;
      setAuthReady(true);
      // Cloud systems only when online — never blocks readiness.
      if (isNetworkOnline()) bootstrapCloudSystemsAfterAuth();
    };

    // ALWAYS unlock UI on the next tick — slow internet must never gate first paint.
    queueMicrotask(markReady);
    void db.whenStorageReady().then(markReady);

    const startSupabase = (options?: { background?: boolean }) => {
      if (!options?.background) {
        setActiveBackend('supabase');
        writeStoredAuthBackend('supabase');
      }

      if (import.meta.env.DEV && shouldApplyDevSessionOverride(window.location.search)) {
        void applyDevSessionOverrideFromUrl().finally(markReady);
        return;
      }

      void (async () => {
        try {
          if (!isNetworkOnline()) return;
          const restored = await withTimeout(
            restoreSupabaseSession(),
            SESSION_MS,
            'Supabase getSession',
          );
          if (cancelled || !restored) return;
          setSession(restored);
          if (!options?.background) {
            setActiveBackend('supabase');
            writeStoredAuthBackend('supabase');
          }
          void applySupabaseSessionSafe(restored);
        } catch (err) {
          console.warn('[auth] Supabase restore failed (UI stays on cache):', err);
        }
      })();

      if (options?.background) return;

      unsubAuth = subscribeSupabaseAuthChanges({
        onRecovery: () => setRecoveryMode(true),
        onSession: (next) => {
          if (cancelled) return;
          if (isDevLocalAuthBypass()) {
            if (!next) return;
          }
          setSession(next);
          void applySupabaseSessionSafe(next);
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

    const startFirebaseBackupListener = () => {
      const auth = getFirebaseAuth();
      if (!auth) return;

      void (async () => {
        if (shouldCompleteFirebaseOAuthRedirect()) {
          const redirectResult = await completeFirebaseOAuthRedirectOnce().catch(() => null);
          if (redirectResult && !redirectResult.ok && redirectResult.reason) {
            console.warn('[auth] Firebase redirect:', redirectResult.reason);
          }
        }

        await auth.authStateReady();
        if (cancelled) return;

        const shouldApplyFirebaseUser = (uid: string) =>
          isSupabaseOAuthDegraded() ||
          readStoredAuthBackend() === 'firebase' ||
          Boolean(readFirebaseBackupLink()?.firebaseUid === uid);

        unsubFirebase = onAuthStateChanged(auth, (user) => {
          if (cancelled) return;
          if (!user) return;
          if (!shouldApplyFirebaseUser(user.uid)) return;
          void applyLegacyFirebaseUser(user, { silent: db.isLoggedIn });
        });

        const current = auth.currentUser;
        if (current && shouldApplyFirebaseUser(current.uid)) {
          void applyLegacyFirebaseUser(current, { silent: db.isLoggedIn });
        }
      })();
    };

    void (async () => {
      try {
        if (isSupabaseOAuthReturnInUrl() && isSupabaseConfigured()) {
          const oauthReturn = await withTimeout(
            completeSupabaseOAuthReturnOnce(),
            OAUTH_RETURN_MS,
            'Supabase OAuth return',
          ).catch(() => ({
            handled: true,
            ok: false,
            reason: 'Sign-in timed out — Supabase auth may be recovering. Try again in a minute.',
          }));
          if (oauthReturn.handled && !oauthReturn.ok && oauthReturn.reason) {
            console.warn('[auth] Supabase OAuth return:', oauthReturn.reason);
          }
        }

        if (isSupabaseConfigured()) {
          startSupabase();
          if (isFirebaseConfigured()) {
            startFirebaseBackupListener();
          }
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
      activeBackend: isSupabaseConfigured() ? 'supabase' : activeBackend,
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

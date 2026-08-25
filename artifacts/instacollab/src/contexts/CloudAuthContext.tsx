import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import type { User as FirebaseUser } from 'firebase/auth';
import { CloudAuthContext } from './cloudAuthStore';
import { db } from '../lib/db/localDb';
import { isCloudAuthConfigured } from '../lib/auth/config';
import type { AuthBackend } from '../lib/auth/types';
import { signOutFast } from '../lib/auth/authHandoff';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { isFirebaseConfigured } from '../lib/firebase/config';
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
  isFirebaseOAuthPrimaryMode,
  isSupabaseOAuthDegraded,
  readStoredAuthBackend,
  writeStoredAuthBackend,
} from '../lib/auth/providerState';
import { readFirebaseBackupLink } from '../lib/auth/firebaseBackupLink';
import {
  applyDevSessionOverrideFromUrl,
  shouldRunDemoSessionBootstrap,
} from '../lib/devSessionUser';
import { syncDeviceAccountForAppUser } from '../lib/auth/deviceAccounts';
import { bootstrapCloudSystemsAfterAuth } from '../lib/appCloudSystems';
const SESSION_MS = 2_500;
const DB_READY_MS = 2_000;
const OAUTH_RETURN_MS = 5_000;



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
  const { fetchFirebaseProfile, userFromFirebaseUser } = await import('../lib/firebase/profile');
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

      if (shouldRunDemoSessionBootstrap()) {
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
      void (async () => {
        const [{ onAuthStateChanged }, { getFirebaseAuth }] = await Promise.all([
          import('firebase/auth'),
          import('../lib/firebase/app'),
        ]);
        const auth = getFirebaseAuth();
        if (!auth) {
          markReady();
          return;
        }
        setActiveBackend('firebase');
        writeStoredAuthBackend('firebase');

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
      void (async () => {
        const [{ onAuthStateChanged }, { getFirebaseAuth }] = await Promise.all([
          import('firebase/auth'),
          import('../lib/firebase/app'),
        ]);
        const auth = getFirebaseAuth();
        if (!auth) return;

        if (shouldCompleteFirebaseOAuthRedirect()) {
          const redirectResult = await completeFirebaseOAuthRedirectOnce().catch(() => null);
          if (redirectResult && !redirectResult.ok && redirectResult.reason) {
            console.warn('[auth] Firebase redirect:', redirectResult.reason);
          }
        }

        await auth.authStateReady();
        if (cancelled) return;

        const shouldApplyFirebaseUser = (uid: string) =>
          isFirebaseOAuthPrimaryMode() ||
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
        if (isSupabaseConfigured()) {
          // Cap cold-start may queue a deep link before this effect runs; always attempt flush.
          const { peekPendingNativeAuthDeepLink } = await import(
            '../lib/auth/nativeAuthDeepLinkQueue'
          );
          if (isSupabaseOAuthReturnInUrl() || peekPendingNativeAuthDeepLink()) {
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
            // Deep-link apply reloads the WebView; stop this boot cycle.
            if (oauthReturn.reason === 'native-deeplink-applied') {
              markReady();
              return;
            }
            // native-hash-session: continue into startSupabase so onAuthStateChange applies.
          }
        }

        // Cap race: launch URL may arrive after first peek — retry briefly.
        if (isSupabaseConfigured()) {
          const { isNativeShell } = await import('../lib/nativeShell');
          if (isNativeShell()) {
            for (const ms of [80, 400, 1200]) {
              window.setTimeout(() => {
                if (cancelled) return;
                void import('../lib/auth/nativeAuthDeepLinkQueue').then(({ peekPendingNativeAuthDeepLink }) => {
                  if (!peekPendingNativeAuthDeepLink()) return;
                  void completeSupabaseOAuthReturnOnce();
                });
              }, ms);
            }
          }
        }

        if (isSupabaseConfigured()) {
          startSupabase();
          const needFirebaseBackup =
            isFirebaseConfigured() &&
            (isFirebaseOAuthPrimaryMode() ||
              isSupabaseOAuthDegraded() ||
              readStoredAuthBackend() === 'firebase' ||
              shouldCompleteFirebaseOAuthRedirect() ||
              Boolean(readFirebaseBackupLink()?.firebaseUid));
          if (needFirebaseBackup) {
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
    const uid = session?.user?.id ?? db.currentUserId;
    setSession(null);
    signOutFast({ clearStoredSession: true, userId: uid });
  }, [session]);

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

/**
 * AuthProvider — Firebase-capable auth implementation (lazy-loaded from boot).
 * Consumers should import useAuth from ../AuthContext (thin re-export).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { AuthContext, type AuthContextValue } from './authContextStore';
import { db } from '../db/localDb';
import { safeLocalStorage } from '../utils';
import { isSupabaseConfigured, isPrimarySupabaseCloud } from './config';
import { hasInstantSessionCache } from '../instantCachePolicy';
import { withTimeout, NET_AUTH_MS } from '../networkPolicy';
import { authSignInWithEmail, authSignInWithGoogle, authSignOut, authSignUp, authRequestPasswordReset, authResendSignupConfirmation, authSendEmailOtp, authVerifyEmailOtp } from './authService';
import { syncCloudSessionNow } from './syncSession';
import { applyFirebaseOAuthSessionToLocalDb } from './applyFirebaseBackupSession';
import {
  flushAuthHandoffInBackground,
  finalizeLocalAuthSession,
  runProviderSignOutInBackground,
  signOutFast,
} from './authHandoff';
import {
  applyInstantAccountSwitch,
  persistOutgoingAccountSessionFast,
} from './accountSwitchFast';
import { teardownCloudSession, applySupabaseSessionToLocalDb, restoreStoredAccountSession } from './sessionManager';
import { isCloudAuthUserId } from './cloudProfile';
import { isSupabaseAuthUserId } from './activeBackend';
import { findSupabaseUserIdByEmail } from './firebaseBackupLink';
import { getSupabaseClient } from '../supabase/client';
import { scheduleLiveSessionSync } from '../liveSessionSync';
import { isKnownLocalDemoEmail } from './localDemoAuth';
import { signInDemoWithCloudSync } from './demoCloudAuth';
import {
  accountFromAppUser,
  accountFromFirebaseUser,
  accountFromSupabaseUser,
  clearActiveDeviceUid,
  clearGoogleAccessToken,
  enrichDeviceAccountsForDisplay,
  loadGoogleAccessToken,
  readActiveDeviceUid,
  filterEligibleDeviceAccounts,
  pruneIneligibleDeviceAccounts,
  readDeviceAccounts,
  removeDeviceAccount as removeStoredDeviceAccount,
  saveGoogleAccessToken,
  upsertDeviceAccount,
  writeActiveDeviceUid,
  writeDeviceAccounts,
  type StoredDeviceAccount,
} from './deviceAccounts';
import {
  clearStoredAccountSession,
  resolveAppUserIdForDeviceAccount,
  saveStoredAccountSessionMirrored,
  sessionLookupUids,
} from './storedAccountSessions';

async function loadFirebaseAuth() {
  return import('firebase/auth');
}

async function loadFirebaseFirestore() {
  return import('firebase/firestore');
}

async function loadFirebaseApp() {
  return import('../firebase/app');
}

let firebaseAppMod: typeof import('../firebase/app') | null = null;
let firebaseAuthMod: typeof import('firebase/auth') | null = null;
let firebaseFsMod: typeof import('firebase/firestore') | null = null;

async function ensureFirebase() {
  if (!firebaseAppMod) firebaseAppMod = await loadFirebaseApp();
  if (!firebaseAuthMod) firebaseAuthMod = await loadFirebaseAuth();
  if (!firebaseFsMod) firebaseFsMod = await loadFirebaseFirestore();
  return {
    app: firebaseAppMod,
    authApi: firebaseAuthMod,
    fs: firebaseFsMod,
  };
}

function persistGoogleCredential(
  uid: string,
  credential: { accessToken?: string | null } | null | undefined,
) {
  if (credential?.accessToken) {
    saveGoogleAccessToken(uid, credential.accessToken);
    return credential.accessToken;
  }
  return loadGoogleAccessToken(uid);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(() => {
    if (isPrimarySupabaseCloud()) return false;
    return !hasInstantSessionCache();
  });
  const [userAccounts, setUserAccounts] = useState<StoredDeviceAccount[]>(() =>
    filterEligibleDeviceAccounts(readDeviceAccounts()),
  );
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  /** Bumps on every account switch so a stale async restore cannot overwrite a newer selection. */
  const accountSwitchGenerationRef = useRef(0);

  const ensureDeviceAccountsSynced = useCallback(async () => {
    let next = pruneIneligibleDeviceAccounts();

    if (isPrimarySupabaseCloud()) {
      const supabase = getSupabaseClient();
      const session = supabase
        ? (
            await withTimeout(
              supabase.auth.getSession(),
              NET_AUTH_MS,
              'Supabase getSession',
            ).catch(() => ({ data: { session: null } }))
          ).data.session
        : null;
      if (session?.user) {
        next = upsertDeviceAccount(accountFromSupabaseUser(session.user), next);
        if (session.refresh_token) {
          saveStoredAccountSessionMirrored(session.user.id, session);
        }
      }
    } else {
      const { app } = await ensureFirebase();
      const firebaseUser = app.getFirebaseAuth()?.currentUser;
      if (firebaseUser) {
        next = upsertDeviceAccount(accountFromFirebaseUser(firebaseUser), next);
      }
    }

    const appUser = db.currentUser;
    if (appUser?.id && (!isSupabaseConfigured() || isCloudAuthUserId(appUser.id))) {
      next = upsertDeviceAccount(accountFromAppUser(appUser), next);
    }

    // One identity per switcher row (Firebase lane collapses onto Supabase uuid).
    next = filterEligibleDeviceAccounts(next);
    next = enrichDeviceAccountsForDisplay(next, db.users ?? []);
    writeDeviceAccounts(next);
    setUserAccounts(next);

    void import('./identityDedupe')
      .then((m) =>
        m.pruneLocalDuplicatePublicUserIds({
          users: db.users ?? [],
          currentUserId: db.currentUserId,
          saveUsers: (users) => db.save('users', users),
          deleteAccountSnapshot: (userId) => db.deleteAccountSnapshot(userId),
        }),
      )
      .then((result) => {
        if (result.removedUsers || result.collapsedDeviceAccounts) {
          setUserAccounts(filterEligibleDeviceAccounts(readDeviceAccounts()));
        }
      })
      .catch(() => undefined);
  }, []);

  /** Fast local refresh for the account switcher — no blocking network. */
  const refreshAccountSwitcher = useCallback(async () => {
    await persistOutgoingAccountSessionFast();
    setUserAccounts(filterEligibleDeviceAccounts(enrichDeviceAccountsForDisplay(readDeviceAccounts(), db.users ?? [])));
    void ensureDeviceAccountsSynced();
  }, [ensureDeviceAccountsSynced]);

  useEffect(() => {
    const onDeviceAccountsChanged = () => {
      setUserAccounts(filterEligibleDeviceAccounts(readDeviceAccounts()));
    };
    const onLiveSessionSynced = () => {
      void ensureDeviceAccountsSynced();
    };
    window.addEventListener('device-accounts-changed', onDeviceAccountsChanged);
    window.addEventListener('live-session-synced', onLiveSessionSynced);
    return () => {
      window.removeEventListener('device-accounts-changed', onDeviceAccountsChanged);
      window.removeEventListener('live-session-synced', onLiveSessionSynced);
    };
  }, [ensureDeviceAccountsSynced]);

  // Supabase-primary: keep googleAccessToken in sync with provider_token / local cache.
  useEffect(() => {
    if (!isPrimarySupabaseCloud()) return;
    let cancelled = false;
    const syncGoogleToken = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      const session = data.session;
      if (cancelled || !session?.user) return;
      const { persistGoogleProviderTokenFromSession } = await import('./completeSupabaseOAuthReturn');
      const fromSession = persistGoogleProviderTokenFromSession(session);
      const cached = loadGoogleAccessToken(session.user.id);
      if (!cancelled) setGoogleAccessToken(fromSession || cached);
    };
    void syncGoogleToken();
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session?.user) {
        setGoogleAccessToken(null);
        return;
      }
      void import('./completeSupabaseOAuthReturn').then(({ persistGoogleProviderTokenFromSession }) => {
        const fromSession = persistGoogleProviderTokenFromSession(session);
        const cached = loadGoogleAccessToken(session.user.id);
        if (!cancelled) setGoogleAccessToken(fromSession || cached);
      });
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const applyLocalAccountSelection = async (uid: string) => {
    writeActiveDeviceUid(uid);
    setProfile(null);
    db.login(uid);
    setGoogleAccessToken(loadGoogleAccessToken(uid));

    let loadedProfile: any = null;

    const localDoc = safeLocalStorage.getItem('local_profile_' + uid);
    if (localDoc) {
      try {
        loadedProfile = JSON.parse(localDoc);
        setProfile(loadedProfile);
      } catch {
        /* ignore */
      }
    }

    if (!loadedProfile) {
      const acc = readDeviceAccounts().find((a) => a.uid === uid);
      if (acc) {
        const fallback = {
          id: acc.uid,
          username: acc.displayName?.toLowerCase().replace(/\s+/g, '') || 'user',
          fullName: acc.displayName || 'User',
          avatarUrl: acc.photoURL || '',
          bio: '',
          website: '',
          followers: 0,
          following: 0,
          postsCount: 0,
          isVerified: false,
        };
        loadedProfile = fallback;
        setProfile(fallback);
      }
    }

    const acc = readDeviceAccounts().find((a) => a.uid === uid);
    if (acc) {
      setUser({
        uid: acc.uid,
        displayName: acc.displayName,
        email: acc.email,
        photoURL: acc.photoURL,
      } as User);
    }

    const { app, fs } = await ensureFirebase();
    const firestoreDB = app.getFirestoreDB();
    if (firestoreDB) {
      const docRef = fs.doc(firestoreDB, 'users', uid);
      fs.getDoc(docRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const freshProfile = docSnap.data();
            setProfile(freshProfile);
            safeLocalStorage.setItem('local_profile_' + uid, JSON.stringify(freshProfile));
          }
        })
        .catch((e) => {
          if (e instanceof Error && e.message.includes('offline')) {
            console.debug('Background Firestore profile fetch skipped: client is offline');
          } else {
            console.warn('Background Firestore profile fetch failed on account selection:', e);
          }
        });
    }

    scheduleLiveSessionSync(uid);
  };

  const persistCurrentAccountBeforeSwitch = async () => {
    await persistOutgoingAccountSessionFast();
  };

  const paintDeviceAccountUser = (deviceUid: string) => {
    const account = readDeviceAccounts().find((row) => row.uid === deviceUid);
    if (!account) return;
    setUser({
      uid: account.uid,
      displayName: account.displayName,
      email: account.email,
      photoURL: account.photoURL,
    } as User);
  };

  const selectAccount = async (uid: string, password?: string) => {
    const deviceUid = uid.trim();
    if (!deviceUid) return;

    if (isPrimarySupabaseCloud()) {
      if (!isCloudAuthUserId(deviceUid)) {
        throw new Error('Local demo accounts are not available while cloud sign-in is enabled.');
      }

      const appUserId = resolveAppUserIdForDeviceAccount(deviceUid);
      const supabase = getSupabaseClient();
      const session = supabase
        ? (
            await withTimeout(
              supabase.auth.getSession(),
              450,
              'Supabase getSession',
            ).catch(() => ({ data: { session: null as import('@supabase/supabase-js').Session | null } }))
          ).data.session
        : null;
      const sessionUid = session?.user?.id;
      const linkedIds = new Set(sessionLookupUids(deviceUid));
      const isAlreadyActive =
        (sessionUid && linkedIds.has(sessionUid)) ||
        db.currentUserId === appUserId ||
        db.currentUserId === deviceUid ||
        readActiveDeviceUid() === deviceUid ||
        readActiveDeviceUid() === appUserId;

      if (isAlreadyActive) {
        if (session) {
          await applySupabaseSessionToLocalDb(session);
        }
        scheduleLiveSessionSync(appUserId);
        return;
      }

      const acc = readDeviceAccounts().find((row) => row.uid === deviceUid);
      const loginEmail = acc?.email?.trim() || '';

      if (password?.trim() && loginEmail) {
        const switchGen = ++accountSwitchGenerationRef.current;
        await persistOutgoingAccountSessionFast();
        teardownCloudSession();
        runProviderSignOutInBackground();

        const result = await authSignInWithEmail(loginEmail, password);
        if (accountSwitchGenerationRef.current !== switchGen) return;
        if (!result.ok) {
          throw new Error(result.reason ?? 'Email sign-in failed.');
        }

        const sync = await syncCloudSessionNow();
        if (accountSwitchGenerationRef.current !== switchGen) return;
        if (!sync.ok) {
          throw new Error(sync.reason);
        }

        void ensureDeviceAccountsSynced();
        scheduleLiveSessionSync(db.currentUser?.id ?? appUserId);
        return;
      }

      await persistOutgoingAccountSessionFast();

      const switchGen = ++accountSwitchGenerationRef.current;
      const instant = applyInstantAccountSwitch(deviceUid);
      paintDeviceAccountUser(deviceUid);
      if (!readDeviceAccounts().some((row) => row.uid === deviceUid) && instant.appUserId) {
        setUser({ uid: instant.appUserId } as User);
      }

      teardownCloudSession();

      const restoreTargets = [
        deviceUid,
        appUserId,
        findSupabaseUserIdByEmail(acc?.email) ?? '',
      ].filter(Boolean);

      let restored = false;
      for (const targetUid of restoreTargets) {
        if (accountSwitchGenerationRef.current !== switchGen) return;
        const result = await restoreStoredAccountSession(targetUid);
        if (accountSwitchGenerationRef.current !== switchGen) return;
        if (result.ok) {
          restored = true;
          break;
        }
      }

      if (accountSwitchGenerationRef.current !== switchGen) return;

      if (!restored && !isSupabaseAuthUserId(deviceUid)) {
        await applyLocalAccountSelection(deviceUid);
      }

      if (accountSwitchGenerationRef.current !== switchGen) return;

      void ensureDeviceAccountsSynced();
      scheduleLiveSessionSync(instant.appUserId);
      return;
    }

    await applyLocalAccountSelection(uid);
  };

  const removeAccount = (uid: string) => {
    const aliases = sessionLookupUids(uid);
    db.deleteAccountSnapshot(uid);
    for (const alias of aliases) {
      clearStoredAccountSession(alias);
      db.deleteAccountSnapshot(alias);
    }
    const next = removeStoredDeviceAccount(uid);
    setUserAccounts(filterEligibleDeviceAccounts(next));

    const activeUid = readActiveDeviceUid();
    const removedActive =
      activeUid === uid || aliases.includes(activeUid ?? '');
    if (removedActive) {
      void logout();
    }
  };

  const signInWithGooglePopup = async (options?: {
    selectAccount?: boolean;
    loginHint?: string;
    workspaceScopes?: boolean;
  }): Promise<{ ok: boolean; reason?: string; accessToken?: string | null; redirecting?: boolean }> => {
    if (isPrimarySupabaseCloud()) {
      const cloud = await authSignInWithGoogle(options);
      if (cloud.ok) return { ok: true, redirecting: true };
      return { ok: false, reason: cloud.reason ?? 'Cloud Google sign-in failed.' };
    }

    const { app, authApi } = await ensureFirebase();
    const auth = app.getFirebaseAuth();
    if (!auth) {
      const cloud = await authSignInWithGoogle(options);
      if (cloud.ok) return { ok: true, redirecting: cloud.redirecting };
      return { ok: false, reason: cloud.reason ?? 'Cloud Google sign-in failed.' };
    }

    const { createBasicGoogleAuthProvider, createWorkspaceGoogleAuthProvider, sanitizeGoogleLoginHint } =
      await import('./googleAuthProvider');
    const provider =
      options?.workspaceScopes === true
        ? createWorkspaceGoogleAuthProvider()
        : createBasicGoogleAuthProvider({ selectAccount: options?.selectAccount });
    const hint = sanitizeGoogleLoginHint(options?.loginHint);
    if (hint) {
      provider.setCustomParameters({
        ...(options?.selectAccount || options?.workspaceScopes ? { prompt: 'select_account' } : {}),
        login_hint: hint,
      });
    }
    try {
      let result;
      try {
        result = await authApi.signInWithPopup(auth, provider);
      } catch (popupErr: unknown) {
        const pe = popupErr as { code?: string };
        if (pe.code === 'auth/popup-blocked' || pe.code === 'auth/popup-blocked-by-browser') {
          result = await authApi.signInWithPopup(auth, provider, authApi.browserPopupRedirectResolver);
        } else {
          throw popupErr;
        }
      }
      const credential = authApi.GoogleAuthProvider.credentialFromResult(result);
      const token = persistGoogleCredential(result.user.uid, credential);
      return { ok: true, accessToken: token };
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      if (e.code === 'auth/popup-closed-by-user') {
        return { ok: false, reason: 'Sign-in was cancelled.' };
      }
      if (e.code === 'auth/unauthorized-domain') {
        return {
          ok: false,
          reason:
            'This domain is not authorized for OAuth. Add it under Firebase Console → Authentication → Settings → Authorized domains.',
        };
      }
      return { ok: false, reason: e.message || 'Failed to sign in with Google.' };
    }
  };

  const loginWithGoogle = async () => signInWithGooglePopup();

  /** Admin Panel — request Workspace API scopes only when the user connects Google apps. */
  const connectGoogleWorkspace = async () =>
    signInWithGooglePopup({ selectAccount: true, workspaceScopes: true });

  const linkEmailAccount = async (
    email: string,
    password: string,
  ): Promise<{ ok: boolean; reason?: string; needsEmailConfirmation?: boolean }> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      return { ok: false, reason: 'Enter email and password.' };
    }

    await persistCurrentAccountBeforeSwitch();

    if (isPrimarySupabaseCloud()) {
      teardownCloudSession();
      await authSignOut();

      const result = await authSignInWithEmail(trimmedEmail, password);
      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }

      const sync = await syncCloudSessionNow();
      if (!sync.ok) {
        return { ok: false, reason: sync.reason };
      }

      await ensureDeviceAccountsSynced();
      if (db.currentUser?.id) scheduleLiveSessionSync(db.currentUser.id);
      return { ok: true };
    }

    const { app, authApi } = await ensureFirebase();
    const auth = app.getFirebaseAuth();
    if (!auth) {
      return { ok: false, reason: 'Cloud auth is not configured.' };
    }

    if (auth.currentUser) {
      await authApi.signOut(auth);
    }

    try {
      await authApi.signInWithEmailAndPassword(auth, trimmedEmail, password);
      await ensureDeviceAccountsSynced();
      return { ok: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Email sign-in failed.';
      return { ok: false, reason: message };
    }
  };

  const linkEmailSignUp = async (
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ ok: boolean; reason?: string; needsEmailConfirmation?: boolean }> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      return { ok: false, reason: 'Enter email and password.' };
    }

    await persistCurrentAccountBeforeSwitch();

    if (isPrimarySupabaseCloud()) {
      teardownCloudSession();
      await authSignOut();

      const username =
        (displayName?.trim() || trimmedEmail.split('@')[0] || 'user')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .slice(0, 24) || 'user';
      const result = await authSignUp({
        email: trimmedEmail,
        password,
        username: username.length >= 3 ? username : `user_${username}`,
        displayName: displayName?.trim() || username,
      });
      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }
      if (result.needsEmailConfirmation) {
        return {
          ok: true,
          needsEmailConfirmation: true,
          reason:
            'Check your inbox for a confirmation link (not a numeric code). Open spam/promotions if needed, then sign in.',
        };
      }

      const sync = await syncCloudSessionNow();
      if (!sync.ok) {
        return { ok: false, reason: sync.reason };
      }

      await ensureDeviceAccountsSynced();
      if (db.currentUser?.id) scheduleLiveSessionSync(db.currentUser.id);
      return { ok: true };
    }

    const { app, authApi } = await ensureFirebase();
    const auth = app.getFirebaseAuth();
    if (!auth) {
      return { ok: false, reason: 'Cloud auth is not configured.' };
    }

    if (auth.currentUser) {
      await authApi.signOut(auth);
    }

    try {
      const cred = await authApi.createUserWithEmailAndPassword(auth, trimmedEmail, password);
      if (displayName?.trim()) {
        await authApi.updateProfile(cred.user, { displayName: displayName.trim() });
      }
      await ensureDeviceAccountsSynced();
      return { ok: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Email sign-up failed.';
      return { ok: false, reason: message };
    }
  };

  const resendEmailConfirmation = async (
    email: string,
  ): Promise<{ ok: boolean; reason?: string }> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return { ok: false, reason: 'Enter your email address.' };
    }
    const result = await authResendSignupConfirmation(trimmedEmail);
    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }
    return {
      ok: true,
      reason: 'Confirmation email sent. Check inbox and spam — the message contains a link, not a code.',
    };
  };

  const sendEmailAuthOtp = async (
    email: string,
    options?: { createAccount?: boolean; displayName?: string; username?: string },
  ): Promise<{ ok: boolean; reason?: string }> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return { ok: false, reason: 'Enter your email address.' };
    const result = await authSendEmailOtp(trimmedEmail, {
      shouldCreateUser: options?.createAccount ?? true,
      displayName: options?.displayName,
      username: options?.username,
    });
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true };
  };

  const verifyEmailAuthOtp = async (
    email: string,
    code: string,
    options?: { switchAccount?: boolean },
  ): Promise<{ ok: boolean; reason?: string }> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return { ok: false, reason: 'Enter your email address.' };

    if (options?.switchAccount) {
      await persistCurrentAccountBeforeSwitch();
      teardownCloudSession();
      await authSignOut();
    }

    const result = await authVerifyEmailOtp(trimmedEmail, code);
    if (!result.ok) return { ok: false, reason: result.reason };

    const sync = await syncCloudSessionNow();
    if (!sync.ok) return { ok: false, reason: sync.reason };

    await ensureDeviceAccountsSynced();
    if (db.currentUser?.id) scheduleLiveSessionSync(db.currentUser.id);
    return { ok: true };
  };

  const linkGoogleAccount = async (): Promise<{
    ok: boolean;
    reason?: string;
    redirecting?: boolean;
  }> => {
    flushAuthHandoffInBackground();
    void persistOutgoingAccountSessionFast();

    if (isPrimarySupabaseCloud()) {
      teardownCloudSession();
      runProviderSignOutInBackground();
      const result = await authSignInWithGoogle({ selectAccount: true });
      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }
      return { ok: true, redirecting: true };
    }

    const { app, authApi } = await ensureFirebase();
    const auth = app.getFirebaseAuth();
    const previousUid =
      auth?.currentUser?.uid ?? readActiveDeviceUid() ?? db.currentUser?.id ?? null;

    if (auth?.currentUser) {
      void authApi.signOut(auth).catch(() => undefined);
    }

    const result = await signInWithGooglePopup({ selectAccount: true });
    if (!result.ok) {
      if (previousUid) {
        void selectAccount(previousUid);
      }
      return result;
    }

    const signedInUid = app.getFirebaseAuth()?.currentUser?.uid;
    if (signedInUid && result.accessToken) {
      setGoogleAccessToken(result.accessToken);
    }

    void ensureDeviceAccountsSynced();
    return { ok: true };
  };

  useEffect(() => {
    const schedule = (fn: () => void) => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(fn, { timeout: 4000 });
      } else {
        window.setTimeout(fn, 1500);
      }
    };
    schedule(() => void ensureDeviceAccountsSynced());

    // Supabase-primary: never pull Firebase SDK for session listeners.
    if (isPrimarySupabaseCloud()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeProfile: (() => void) | null = null;

    void (async () => {
      const { app, authApi, fs } = await ensureFirebase();
      if (cancelled) return;
      const firebaseAuth = app.getFirebaseAuth();
      if (!firebaseAuth) {
        const activeUid = readActiveDeviceUid();
        if (activeUid) {
          void selectAccount(activeUid);
        }
        setLoading(false);
        return;
      }

      unsubscribeAuth = authApi.onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      const storedActiveUid = readActiveDeviceUid();
      const supabasePrimary = isSupabaseConfigured();

      if (firebaseUser) {
        const token = loadGoogleAccessToken(firebaseUser.uid);
        if (token) setGoogleAccessToken(token);

        if (supabasePrimary) {
          if (firebaseUser) {
            void applyFirebaseOAuthSessionToLocalDb(firebaseUser, { silent: db.isLoggedIn });
            setUser(firebaseUser);
          }
          setLoading(false);
          return;
        }

        if (!storedActiveUid || storedActiveUid === firebaseUser.uid) {
          writeActiveDeviceUid(firebaseUser.uid);
          setUser(firebaseUser);
          db.login(firebaseUser.uid);
          scheduleLiveSessionSync(firebaseUser.uid);

          setUserAccounts((prev) => {
            const fromFirebase = accountFromFirebaseUser(firebaseUser);
            const uniqueList = upsertDeviceAccount(fromFirebase, prev);
            return uniqueList;
          });

          const firestoreDB = app.getFirestoreDB();
          if (firestoreDB) {
            const profileRef = fs.doc(firestoreDB, 'users', firebaseUser.uid);
            if (unsubscribeProfile) unsubscribeProfile();
            unsubscribeProfile = fs.onSnapshot(profileRef, (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                setProfile(data);
                safeLocalStorage.setItem('local_profile_' + firebaseUser.uid, JSON.stringify(data));

                const updatedUsers = [...db.users];
                const existsIdx = updatedUsers.findIndex((u) => u.id === firebaseUser.uid);
                if (existsIdx >= 0) {
                  updatedUsers[existsIdx] = { ...updatedUsers[existsIdx], ...data };
                } else {
                  updatedUsers.push({ ...data } as import('../../types').User);
                }
                db.save('users', updatedUsers);
              } else {
                const localDoc = safeLocalStorage.getItem('local_profile_' + firebaseUser.uid);
                if (localDoc) {
                  setProfile(JSON.parse(localDoc));
                }
              }
              setLoading(false);
            });
          } else {
            setLoading(false);
          }
        } else {
          await selectAccount(storedActiveUid);
          setLoading(false);
        }
      } else {
        if (supabasePrimary) {
          setUser(null);
          setProfile(null);
          setGoogleAccessToken(null);
          setLoading(false);
          return;
        }
        if (storedActiveUid) {
          await selectAccount(storedActiveUid);
          setLoading(false);
        } else {
          setUser(null);
          setProfile(null);
          setGoogleAccessToken(null);
          if (!isSupabaseConfigured()) {
            db.logout();
          }
          setLoading(false);
        }
      }
    });

    })();

    return () => {
      cancelled = true;
      unsubscribeAuth?.();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [ensureDeviceAccountsSynced]);

  const loginWithApple = async () => {
    alert('Apple Sign-In is being configured for this domain. Please use Google or Email for now.');
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (isPrimarySupabaseCloud()) {
      if (isKnownLocalDemoEmail(email)) {
        const demo = await signInDemoWithCloudSync(email, pass);
        if (demo.ok) {
          await ensureDeviceAccountsSynced();
          return;
        }
        throw new Error(demo.reason);
      }
      const result = await authSignInWithEmail(email, pass);
      if (!result.ok) throw new Error(result.reason ?? 'Email sign-in failed.');
      const sync = await syncCloudSessionNow();
      if (!sync.ok) throw new Error(sync.reason);
      await ensureDeviceAccountsSynced();
      if (db.currentUser?.id) scheduleLiveSessionSync(db.currentUser.id);
      return;
    }
    const { app, authApi } = await ensureFirebase();
    const auth = app.getFirebaseAuth();
    if (!auth) return;
    await authApi.signInWithEmailAndPassword(auth, email, pass);
    if (auth.currentUser?.uid) scheduleLiveSessionSync(auth.currentUser.uid);
  };

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    if (isPrimarySupabaseCloud()) {
      const username = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'user';
      const result = await authSignUp({
        email,
        password: pass,
        username,
        displayName: name.trim() || username,
      });
      if (!result.ok) throw new Error(result.reason ?? 'Sign-up failed.');
      if (result.needsEmailConfirmation) {
        throw new Error(
          'Check your email for a confirmation link (not a code), then sign in. Check spam/promotions if needed.',
        );
      }
      const sync = await syncCloudSessionNow();
      if (!sync.ok) throw new Error(sync.reason);
      await ensureDeviceAccountsSynced();
      if (db.currentUser?.id) scheduleLiveSessionSync(db.currentUser.id);
      return;
    }
    const { app, authApi } = await ensureFirebase();
    const auth = app.getFirebaseAuth();
    if (!auth) return;
    const cred = await authApi.createUserWithEmailAndPassword(auth, email, pass);
    if (name) {
      await authApi.updateProfile(cred.user, { displayName: name });
    }
    scheduleLiveSessionSync(cred.user.uid);
  };

  const resetPassword = async (email: string) => {
    if (isPrimarySupabaseCloud()) {
      const result = await authRequestPasswordReset(email);
      if (!result.ok) throw new Error(result.reason ?? 'Password reset failed.');
      return;
    }
    const { app, authApi } = await ensureFirebase();
    const auth = app.getFirebaseAuth();
    if (!auth) return;
    await authApi.sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    const uid = db.currentUserId;
    setGoogleAccessToken(null);
    setUser(null);
    setProfile(null);
    if (uid) clearGoogleAccessToken(uid);

    signOutFast({ clearStoredSession: true, userId: uid });
  };

  const switchAccount = linkGoogleAccount;

  const deleteAccount = async () => {
    const { app, authApi } = await ensureFirebase();
    const auth = app.getFirebaseAuth();
    const currentUser = auth?.currentUser;
    const uid = currentUser?.uid ?? readActiveDeviceUid();
    if (currentUser) {
      await authApi.deleteUser(currentUser);
    }
    if (uid) {
      removeStoredDeviceAccount(uid);
      setUserAccounts(filterEligibleDeviceAccounts(readDeviceAccounts()));
    }
    clearActiveDeviceUid();
    clearGoogleAccessToken(uid ?? undefined);
    setGoogleAccessToken(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        setProfile,
        loading,
        userAccounts,
        googleAccessToken,
        loginWithGoogle,
        connectGoogleWorkspace,
        loginWithApple,
        loginWithEmail,
        signupWithEmail,
        resetPassword,
        logout,
        switchAccount,
        linkGoogleAccount,
        linkEmailAccount,
        linkEmailSignUp,
        resendEmailConfirmation,
        sendEmailAuthOtp,
        verifyEmailAuthOtp,
        deleteAccount,
        selectAccount,
        removeAccount,
        ensureDeviceAccountsSynced,
        refreshAccountSwitcher,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

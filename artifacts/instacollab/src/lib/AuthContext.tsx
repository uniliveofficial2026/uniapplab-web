import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver,
  deleteUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDB } from './firebase';
import { db } from './db/localDb';
import { safeLocalStorage } from './utils';
import { isSupabaseConfigured, isPrimarySupabaseCloud } from './auth/config';
import { authSignInWithEmail, authSignInWithGoogle, authSignOut, authSignUp, authRequestPasswordReset } from './auth/authService';
import { syncCloudSessionNow } from './auth/syncSession';
import { flushCloudAppStateSync, stopCloudAppStateRealtimeAsync } from './auth/cloudAppState';
import { flushCloudProfileSync, isCloudAuthUserId } from './auth/cloudProfile';
import { teardownCloudSession, applySupabaseSessionToLocalDb } from './auth/sessionManager';
import { getSupabaseClient } from './supabase/client';
import { scheduleLiveSessionSync } from './liveSessionSync';
import { isKnownLocalDemoEmail } from './auth/localDemoAuth';
import { signInDemoWithCloudSync } from './auth/demoCloudAuth';
import { createWorkspaceGoogleAuthProvider } from './auth/googleAuthProvider';
import {
  accountFromAppUser,
  accountFromFirebaseUser,
  accountFromSupabaseUser,
  clearActiveDeviceUid,
  clearGoogleAccessToken,
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
} from './auth/deviceAccounts';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  setProfile: React.Dispatch<React.SetStateAction<any | null>>;
  loading: boolean;
  userAccounts: StoredDeviceAccount[];
  googleAccessToken: string | null;
  loginWithGoogle: () => Promise<{ ok: boolean; reason?: string; redirecting?: boolean }>;
  loginWithApple: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  signupWithEmail: (e: string, p: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  switchAccount: () => Promise<{ ok: boolean; reason?: string; redirecting?: boolean }>;
  linkGoogleAccount: () => Promise<{ ok: boolean; reason?: string; redirecting?: boolean }>;
  linkEmailAccount: (email: string, password: string) => Promise<{ ok: boolean; reason?: string }>;
  deleteAccount: () => Promise<void>;
  selectAccount: (uid: string, password?: string) => Promise<void>;
  removeAccount: (uid: string) => void;
  ensureDeviceAccountsSynced: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistGoogleCredential(uid: string, credential: ReturnType<typeof GoogleAuthProvider.credentialFromResult>) {
  if (credential?.accessToken) {
    saveGoogleAccessToken(uid, credential.accessToken);
    return credential.accessToken;
  }
  return loadGoogleAccessToken(uid);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAccounts, setUserAccounts] = useState<StoredDeviceAccount[]>(() =>
    filterEligibleDeviceAccounts(readDeviceAccounts()),
  );
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  const ensureDeviceAccountsSynced = useCallback(async () => {
    let next = pruneIneligibleDeviceAccounts();

    if (isPrimarySupabaseCloud()) {
      const supabase = getSupabaseClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (session?.user) {
        next = upsertDeviceAccount(accountFromSupabaseUser(session.user), next);
      }
    } else {
      const firebaseUser = getFirebaseAuth()?.currentUser;
      if (firebaseUser) {
        next = upsertDeviceAccount(accountFromFirebaseUser(firebaseUser), next);
      }
    }

    const appUser = db.currentUser;
    if (appUser?.id && (!isSupabaseConfigured() || isCloudAuthUserId(appUser.id))) {
      next = upsertDeviceAccount(accountFromAppUser(appUser), next);
    }

    next = filterEligibleDeviceAccounts(next);
    writeDeviceAccounts(next);
    setUserAccounts(next);
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

    const firestoreDB = getFirestoreDB();
    if (firestoreDB) {
      const docRef = doc(firestoreDB, 'users', uid);
      getDoc(docRef)
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
    await flushCloudAppStateSync();
    await flushCloudProfileSync();
    await ensureDeviceAccountsSynced();

    const supabase = getSupabaseClient();
    const supabaseSession = supabase ? (await supabase.auth.getSession()).data.session : null;
    const previousUid =
      supabaseSession?.user?.id ??
      getFirebaseAuth()?.currentUser?.uid ??
      readActiveDeviceUid() ??
      db.currentUser?.id ??
      null;

    if (!previousUid) return;

    const existing = readDeviceAccounts().find((a) => a.uid === previousUid);
    if (existing) {
      upsertDeviceAccount(existing);
    } else if (supabaseSession?.user) {
      upsertDeviceAccount(accountFromSupabaseUser(supabaseSession.user));
    } else if (getFirebaseAuth()?.currentUser) {
      upsertDeviceAccount(accountFromFirebaseUser(getFirebaseAuth()!.currentUser!));
    } else if (db.currentUser) {
      upsertDeviceAccount(accountFromAppUser(db.currentUser));
    }
  };

  const selectAccount = async (uid: string, password?: string) => {
    if (isPrimarySupabaseCloud()) {
      if (!isCloudAuthUserId(uid)) {
        throw new Error('Local demo accounts are not available while cloud sign-in is enabled.');
      }

      const supabase = getSupabaseClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const sessionUid = session?.user?.id;

      if (sessionUid === uid) {
        if (session) {
          await applySupabaseSessionToLocalDb(session);
        } else {
          const sync = await syncCloudSessionNow();
          if (!sync.ok) {
            throw new Error(sync.reason);
          }
        }
        scheduleLiveSessionSync(uid);
        return;
      }

      const acc = readDeviceAccounts().find((a) => a.uid === uid);
      const loginEmail = acc?.email?.trim() || '';

      if (password?.trim() && loginEmail) {
        await persistCurrentAccountBeforeSwitch();
        teardownCloudSession();
        await authSignOut();

        const result = await authSignInWithEmail(loginEmail, password);
        if (!result.ok) {
          throw new Error(result.reason ?? 'Email sign-in failed.');
        }

        const sync = await syncCloudSessionNow();
        if (!sync.ok) {
          throw new Error(sync.reason);
        }

        await ensureDeviceAccountsSynced();
        scheduleLiveSessionSync(db.currentUser?.id ?? uid);
        return;
      }

      await persistCurrentAccountBeforeSwitch();
      teardownCloudSession();
      await authSignOut();

      const result = await authSignInWithGoogle({
        selectAccount: true,
        loginHint: loginEmail || undefined,
      });
      if (!result.ok) {
        throw new Error(result.reason ?? 'Google sign-in failed.');
      }
      return;
    }

    await applyLocalAccountSelection(uid);
  };

  const removeAccount = (uid: string) => {
    db.deleteAccountSnapshot(uid);
    const next = removeStoredDeviceAccount(uid);
    setUserAccounts(filterEligibleDeviceAccounts(next));

    const activeUid = readActiveDeviceUid();
    if (activeUid === uid) {
      void logout();
    }
  };

  const signInWithGooglePopup = async (options?: {
    selectAccount?: boolean;
    loginHint?: string;
  }): Promise<{ ok: boolean; reason?: string; accessToken?: string | null; redirecting?: boolean }> => {
    if (isPrimarySupabaseCloud()) {
      const cloud = await authSignInWithGoogle(options);
      if (cloud.ok) return { ok: true, redirecting: true };
      return { ok: false, reason: cloud.reason ?? 'Cloud Google sign-in failed.' };
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      const cloud = await authSignInWithGoogle(options);
      if (cloud.ok) return { ok: true, redirecting: cloud.redirecting };
      return { ok: false, reason: cloud.reason ?? 'Cloud Google sign-in failed.' };
    }

    const provider = createWorkspaceGoogleAuthProvider();
    try {
      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupErr: unknown) {
        const pe = popupErr as { code?: string };
        if (pe.code === 'auth/popup-blocked' || pe.code === 'auth/popup-blocked-by-browser') {
          result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
        } else {
          throw popupErr;
        }
      }
      const credential = GoogleAuthProvider.credentialFromResult(result);
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

  const linkEmailAccount = async (
    email: string,
    password: string,
  ): Promise<{ ok: boolean; reason?: string }> => {
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

    const auth = getFirebaseAuth();
    if (!auth) {
      return { ok: false, reason: 'Cloud auth is not configured.' };
    }

    if (auth.currentUser) {
      await signOut(auth);
    }

    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      await ensureDeviceAccountsSynced();
      return { ok: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Email sign-in failed.';
      return { ok: false, reason: message };
    }
  };

  const linkGoogleAccount = async (): Promise<{
    ok: boolean;
    reason?: string;
    redirecting?: boolean;
  }> => {
    await persistCurrentAccountBeforeSwitch();

    if (isPrimarySupabaseCloud()) {
      teardownCloudSession();
      await authSignOut();
      const result = await authSignInWithGoogle({ selectAccount: true });
      await ensureDeviceAccountsSynced();
      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }
      return { ok: true, redirecting: true };
    }

    const auth = getFirebaseAuth();
    const previousUid =
      auth?.currentUser?.uid ?? readActiveDeviceUid() ?? db.currentUser?.id ?? null;

    if (auth?.currentUser) {
      await signOut(auth);
    }

    const result = await signInWithGooglePopup({ selectAccount: true });
    if (!result.ok) {
      if (previousUid) {
        await selectAccount(previousUid);
      }
      return result;
    }

    const signedInUid = getFirebaseAuth()?.currentUser?.uid;
    if (signedInUid && result.accessToken) {
      setGoogleAccessToken(result.accessToken);
    }

    ensureDeviceAccountsSynced();
    return { ok: true };
  };

  useEffect(() => {
    void ensureDeviceAccountsSynced();

    let unsubscribeProfile: (() => void) | null = null;

    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      const activeUid = readActiveDeviceUid();
      if (activeUid) {
        void selectAccount(activeUid);
      }
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      const storedActiveUid = readActiveDeviceUid();
      const supabasePrimary = isSupabaseConfigured();

      if (firebaseUser) {
        const token = loadGoogleAccessToken(firebaseUser.uid);
        if (token) setGoogleAccessToken(token);

        if (supabasePrimary) {
          setUser(firebaseUser);
          setLoading(false);
          return;
        }

        if (!storedActiveUid || storedActiveUid === firebaseUser.uid) {
          writeActiveDeviceUid(firebaseUser.uid);
          setUser(firebaseUser);
          db.login(firebaseUser.uid);
          scheduleLiveSessionSync(firebaseUser.uid);

          setUserAccounts((prev) => {
            const uniqueList = upsertDeviceAccount(accountFromFirebaseUser(firebaseUser), prev);
            return uniqueList;
          });

          const firestoreDB = getFirestoreDB();
          if (firestoreDB) {
            const profileRef = doc(firestoreDB, 'users', firebaseUser.uid);
            if (unsubscribeProfile) unsubscribeProfile();
            unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                setProfile(data);
                safeLocalStorage.setItem('local_profile_' + firebaseUser.uid, JSON.stringify(data));

                const updatedUsers = [...db.users];
                const existsIdx = updatedUsers.findIndex((u) => u.id === firebaseUser.uid);
                if (existsIdx >= 0) {
                  updatedUsers[existsIdx] = { ...updatedUsers[existsIdx], ...data };
                } else {
                  updatedUsers.push({ ...data } as import('../types').User);
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

    return () => {
      unsubscribeAuth();
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
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signInWithEmailAndPassword(auth, email, pass);
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
      const sync = await syncCloudSessionNow();
      if (!sync.ok) throw new Error(sync.reason);
      await ensureDeviceAccountsSynced();
      if (db.currentUser?.id) scheduleLiveSessionSync(db.currentUser.id);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) return;
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    scheduleLiveSessionSync(cred.user.uid);
  };

  const resetPassword = async (email: string) => {
    if (isPrimarySupabaseCloud()) {
      const result = await authRequestPasswordReset(email);
      if (!result.ok) throw new Error(result.reason ?? 'Password reset failed.');
      return;
    }
    const { sendPasswordResetEmail } = await import('firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth) return;
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await flushCloudAppStateSync();
    await flushCloudProfileSync();
    if (isSupabaseConfigured()) {
      try {
        await authSignOut();
      } catch (err) {
        console.warn('[auth] signOut failed:', err);
      }
      teardownCloudSession();
      await stopCloudAppStateRealtimeAsync();
      clearActiveDeviceUid();
      setGoogleAccessToken(null);
      setUser(null);
      setProfile(null);
      db.logoutSession();
      return;
    }
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
    clearActiveDeviceUid();
    setGoogleAccessToken(null);
    setUser(null);
    setProfile(null);
    db.logoutSession();
  };

  const switchAccount = linkGoogleAccount;

  const deleteAccount = async () => {
    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser;
    const uid = currentUser?.uid ?? readActiveDeviceUid();
    if (currentUser) {
      await deleteUser(currentUser);
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
        loginWithApple,
        loginWithEmail,
        signupWithEmail,
        resetPassword,
        logout,
        switchAccount,
        linkGoogleAccount,
        linkEmailAccount,
        deleteAccount,
        selectAccount,
        removeAccount,
        ensureDeviceAccountsSynced,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

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
import { authSignInWithGoogle, authSignOut } from './auth/authService';
import { teardownCloudSession } from './auth/sessionManager';
import { getSupabaseClient } from './supabase/client';
import { createWorkspaceGoogleAuthProvider } from './auth/googleAuthProvider';
import {
  accountFromAppUser,
  accountFromFirebaseUser,
  clearActiveDeviceUid,
  clearGoogleAccessToken,
  loadGoogleAccessToken,
  readActiveDeviceUid,
  readDeviceAccounts,
  removeDeviceAccount as removeStoredDeviceAccount,
  saveGoogleAccessToken,
  upsertDeviceAccount,
  writeActiveDeviceUid,
  type StoredDeviceAccount,
} from './auth/deviceAccounts';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  setProfile: React.Dispatch<React.SetStateAction<any | null>>;
  loading: boolean;
  userAccounts: StoredDeviceAccount[];
  googleAccessToken: string | null;
  loginWithGoogle: () => Promise<{ ok: boolean; reason?: string }>;
  loginWithApple: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  signupWithEmail: (e: string, p: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  switchAccount: () => Promise<{ ok: boolean; reason?: string }>;
  linkGoogleAccount: () => Promise<{ ok: boolean; reason?: string }>;
  deleteAccount: () => Promise<void>;
  selectAccount: (uid: string) => Promise<void>;
  removeAccount: (uid: string) => void;
  ensureDeviceAccountsSynced: () => void;
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
  const [userAccounts, setUserAccounts] = useState<StoredDeviceAccount[]>(() => readDeviceAccounts());
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  const ensureDeviceAccountsSynced = useCallback(() => {
    let next = readDeviceAccounts();
    const firebaseAuth = getFirebaseAuth();
    const firebaseUser = firebaseAuth?.currentUser;
    if (firebaseUser) {
      next = upsertDeviceAccount(accountFromFirebaseUser(firebaseUser), next);
    }
    const appUser = db.currentUser;
    if (appUser?.id) {
      next = upsertDeviceAccount(accountFromAppUser(appUser), next);
    }
    setUserAccounts(next);
  }, []);

  const selectAccount = async (uid: string) => {
    if (isPrimarySupabaseCloud()) {
      const supabase = getSupabaseClient();
      const session = supabase
        ? (await supabase.auth.getSession()).data.session
        : null;
      if (session?.user?.id && session.user.id !== uid) {
        teardownCloudSession();
        await authSignOut();
      }
    }

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
  };

  const removeAccount = (uid: string) => {
    db.deleteAccountSnapshot(uid);
    const next = removeStoredDeviceAccount(uid);
    setUserAccounts(next);

    const activeUid = readActiveDeviceUid();
    if (activeUid === uid) {
      void logout();
    }
  };

  const signInWithGooglePopup = async (): Promise<{ ok: boolean; reason?: string; accessToken?: string | null }> => {
    const auth = getFirebaseAuth();
    if (!auth) {
      const cloud = await authSignInWithGoogle();
      if (cloud.ok) return { ok: true };
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

  const linkGoogleAccount = async (): Promise<{ ok: boolean; reason?: string }> => {
    ensureDeviceAccountsSynced();

    const previousUid =
      getFirebaseAuth()?.currentUser?.uid ??
      readActiveDeviceUid() ??
      db.currentUser?.id ??
      null;

    if (previousUid) {
      const existing = readDeviceAccounts().find((a) => a.uid === previousUid);
      if (existing) {
        upsertDeviceAccount(existing);
      } else if (getFirebaseAuth()?.currentUser) {
        upsertDeviceAccount(accountFromFirebaseUser(getFirebaseAuth()!.currentUser!));
      } else if (db.currentUser) {
        upsertDeviceAccount(accountFromAppUser(db.currentUser));
      }
    }

    const auth = getFirebaseAuth();
    if (auth?.currentUser) {
      await signOut(auth);
    }

    const result = await signInWithGooglePopup();
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
    setUserAccounts(readDeviceAccounts());
    ensureDeviceAccountsSynced();

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
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
  };

  const resetPassword = async (email: string) => {
    const { sendPasswordResetEmail } = await import('firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth) return;
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
    clearActiveDeviceUid();
    setGoogleAccessToken(null);
    setUser(null);
    setProfile(null);
    if (!isSupabaseConfigured()) {
      db.logoutSession();
    }
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
      setUserAccounts(readDeviceAccounts());
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

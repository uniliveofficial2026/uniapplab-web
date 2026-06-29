import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup,
  deleteUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDB } from './firebase';
import { db } from './db';
import { safeLocalStorage } from './utils';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  setProfile: React.Dispatch<React.SetStateAction<any | null>>;
  loading: boolean;
  userAccounts: any[];
  googleAccessToken: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  signupWithEmail: (e: string, p: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  switchAccount: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  selectAccount: (uid: string) => Promise<void>;
  removeAccount: (uid: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAccounts, setUserAccounts] = useState<any[]>([]);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  const selectAccount = async (uid: string) => {
    safeLocalStorage.setItem('local_active_uid', uid);
    db.login(uid);

    let loadedProfile: any = null;

    // Load from local storage immediately so it switches instantaneously
    const localDoc = safeLocalStorage.getItem('local_profile_' + uid);
    if (localDoc) {
      try {
        loadedProfile = JSON.parse(localDoc);
        setProfile(loadedProfile);
      } catch (e) {}
    }

    if (!loadedProfile) {
      const savedAccounts = safeLocalStorage.getItem('user_accounts');
      if (savedAccounts) {
        try {
          const list = JSON.parse(savedAccounts);
          const acc = list.find((a: any) => a.uid === uid);
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
              isVerified: false
            };
            loadedProfile = fallback;
            setProfile(fallback);
          }
        } catch (e) {}
      }
    }

    // Produce synthetic authentic user shape for components
    const saved = safeLocalStorage.getItem('user_accounts');
    if (saved) {
      try {
        const list = JSON.parse(saved);
        const acc = list.find((a: any) => a.uid === uid);
        if (acc) {
          setUser({
            uid: acc.uid,
            displayName: acc.displayName,
            email: acc.email,
            photoURL: acc.photoURL
          } as any);
        }
      } catch (e) {}
    }

    // Effort to load profile from Firestore in the background (non-blocking)
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
            console.debug("Background Firestore profile fetch skipped: client is offline");
          } else {
            console.warn("Background Firestore profile fetch failed on account selection:", e);
          }
        });
    }
  };

  const removeAccount = (uid: string) => {
    setUserAccounts(prev => {
      const newList = prev.filter(a => a.uid !== uid);
      safeLocalStorage.setItem('user_accounts', JSON.stringify(newList));
      return newList;
    });
    safeLocalStorage.removeItem('local_profile_' + uid);
    
    const activeUid = safeLocalStorage.getItem('local_active_uid');
    if (activeUid === uid) {
      logout();
    }
  };

  useEffect(() => {
    // Load local accounts for switching with deduplication
    const saved = safeLocalStorage.getItem('user_accounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const unique = parsed.filter((item: any, idx: number, self: any[]) => 
            item && item.uid && self.findIndex(t => t.uid === item.uid) === idx
          );
          setUserAccounts(unique);
          safeLocalStorage.setItem('user_accounts', JSON.stringify(unique));
        }
      } catch (e) {}
    }

    let unsubscribeProfile: (() => void) | null = null;

    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      console.error('Firebase Auth is not available.');
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      const storedActiveUid = safeLocalStorage.getItem('local_active_uid');

      if (firebaseUser) {
        if (!storedActiveUid || storedActiveUid === firebaseUser.uid) {
          safeLocalStorage.setItem('local_active_uid', firebaseUser.uid);
          setUser(firebaseUser);
          db.login(firebaseUser.uid);

          setUserAccounts(prev => {
            const hasAccount = prev.some(a => a.uid === firebaseUser.uid);
            let newList = prev;
            if (!hasAccount) {
              newList = [...prev, {
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName,
                email: firebaseUser.email,
                photoURL: firebaseUser.photoURL
              }];
            } else {
              newList = prev.map(a => a.uid === firebaseUser.uid ? {
                ...a,
                displayName: firebaseUser.displayName || a.displayName,
                photoURL: firebaseUser.photoURL || a.photoURL
              } : a);
            }
            const uniqueList = newList.filter((item: any, idx: number, self: any[]) => 
              item && item.uid && self.findIndex(t => t.uid === item.uid) === idx
            ).slice(-5);
            safeLocalStorage.setItem('user_accounts', JSON.stringify(uniqueList));
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
                const existsIdx = updatedUsers.findIndex(u => u.id === firebaseUser.uid);
                if (existsIdx >= 0) {
                  updatedUsers[existsIdx] = { ...updatedUsers[existsIdx], ...data };
                } else {
                  updatedUsers.push({ ...data });
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
        if (storedActiveUid) {
          await selectAccount(storedActiveUid);
          setLoading(false);
        } else {
          setUser(null);
          setProfile(null);
          setGoogleAccessToken(null);
          db.logout();
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const loginWithGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      alert('Firebase is not configured. Please check your environment variables.');
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/chat.messages');
    provider.addScope('https://www.googleapis.com/auth/chat.spaces');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');
    
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
      }
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-domain') {
        alert('This domain is not authorized for OAuth operations for your Firebase project. Please add this URL to the Authorized Domains list in your Firebase Console -> Authentication -> Settings.');
      } else {
        alert(error.message || 'Failed to login with Google.');
      }
    }
  };

  const loginWithApple = async () => {
    // Apple Auth implementation requires bundle ID and service ID configuration
    // For this context, we will trigger a notice that Apple Auth is coming soon
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
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  };

  const logout = async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
    safeLocalStorage.removeItem('local_active_uid');
    setGoogleAccessToken(null);
    setUser(null);
    setProfile(null);
  };

  const switchAccount = async () => {
    // For many vendors, switching accounts just means logging out and back in
    // or picking from a list if we implemented custom multi-account storage
    await logout();
    await loginWithGoogle();
  };

  const deleteAccount = async () => {
    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser;
    if (currentUser) {
      // 1. Delete Firestore data (optional but good practice)
      // 2. Delete Auth record
      await deleteUser(currentUser);
    }
    safeLocalStorage.removeItem('local_active_uid');
    setGoogleAccessToken(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
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
      deleteAccount,
      selectAccount,
      removeAccount
    }}>
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

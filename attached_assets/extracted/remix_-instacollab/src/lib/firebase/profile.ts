import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { User } from '../../types';
import {
  normalizePublicUserId,
  profileRowPublicUserIdChangedMs,
} from '../publicUserId';
import type { ProfileRow } from '../supabase/types';
import { getFirebaseFirestore } from './app';
import type { User as FirebaseUser } from 'firebase/auth';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

function profileDocRef(userId: string) {
  const db = getFirebaseFirestore();
  if (!db) throw new Error('Firebase is not configured');
  return doc(db, 'profiles', userId);
}

export async function fetchFirebaseProfile(userId: string): Promise<ProfileRow | null> {
  const db = getFirebaseFirestore();
  if (!db) return null;
  const snap = await getDoc(doc(db, 'profiles', userId));
  if (!snap.exists()) return null;
  return snap.data() as ProfileRow;
}

export async function upsertFirebaseProfile(row: ProfileRow): Promise<ProfileRow> {
  const ref = profileDocRef(row.id);
  const payload = { ...row, updated_at: new Date().toISOString() };
  await setDoc(ref, payload, { merge: true });
  return payload;
}

export async function isFirebasePublicUserIdAvailable(
  publicUserId: string,
  exceptUserId?: string
): Promise<boolean> {
  const db = getFirebaseFirestore();
  if (!db) return true;
  const normalized = normalizePublicUserId(publicUserId);
  const q = query(
    collection(db, 'profiles'),
    where('public_user_id', '==', normalized),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return true;
  const found = snap.docs[0].id;
  return exceptUserId ? found === exceptUserId : false;
}

export async function isFirebaseUsernameAvailable(
  username: string,
  exceptUserId?: string
): Promise<boolean> {
  const db = getFirebaseFirestore();
  if (!db) return true;
  const normalized = username.trim().toLowerCase();
  const q = query(
    collection(db, 'profiles'),
    where('username', '==', normalized),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return true;
  const found = snap.docs[0].id;
  return exceptUserId ? found === exceptUserId : false;
}

export function userFromFirebaseUser(firebaseUser: FirebaseUser, profile: ProfileRow | null): User {
  if (profile) {
    return {
      id: profile.id,
      publicUserId: profile.public_user_id || profile.username,
      publicUserIdChangedAt: profileRowPublicUserIdChangedMs(profile),
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url || DEFAULT_AVATAR,
      bio: profile.bio || '',
      followers: 0,
      following: 0,
      status: 'none',
    };
  }
  const fallbackUsername =
    (firebaseUser.email?.split('@')[0] || 'user').replace(/[^a-z0-9_]/gi, '_').slice(0, 24) ||
    `user_${firebaseUser.uid.slice(0, 8)}`;
  return {
    id: firebaseUser.uid,
    publicUserId: fallbackUsername,
    username: fallbackUsername,
    displayName: firebaseUser.displayName?.trim() || fallbackUsername,
    avatarUrl: firebaseUser.photoURL || DEFAULT_AVATAR,
    bio: '',
    followers: 0,
    following: 0,
    status: 'none',
  };
}

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
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
  exceptUserId?: string | string[]
): Promise<boolean> {
  const db = getFirebaseFirestore();
  if (!db) return true;
  const normalized = normalizePublicUserId(publicUserId);
  const except = new Set(
    (Array.isArray(exceptUserId) ? exceptUserId : exceptUserId ? [exceptUserId] : [])
      .map((id) => id.trim())
      .filter(Boolean),
  );

  const ownedByOther = (docId: string | undefined, data?: Record<string, unknown>): boolean => {
    if (!docId) return false;
    if (except.size === 0) return true;
    if (except.has(docId)) return false;
    const linked =
      typeof data?.linked_supabase_user_id === 'string'
        ? data.linked_supabase_user_id.trim()
        : '';
    if (linked && except.has(linked)) return false;
    return true;
  };

  const byPublic = await getDocs(
    query(collection(db, 'profiles'), where('public_user_id', '==', normalized), limit(1)),
  );
  if (!byPublic.empty) {
    const snap = byPublic.docs[0];
    if (ownedByOther(snap?.id, snap?.data() as Record<string, unknown>)) return false;
  }

  const byUsername = await getDocs(
    query(collection(db, 'profiles'), where('username', '==', normalized), limit(1)),
  );
  if (!byUsername.empty) {
    const snap = byUsername.docs[0];
    if (ownedByOther(snap?.id, snap?.data() as Record<string, unknown>)) return false;
  }

  // Legacy `users` collection also carried public handles.
  const byLegacyPublic = await getDocs(
    query(collection(db, 'users'), where('public_user_id', '==', normalized), limit(1)),
  ).catch(() => null);
  if (byLegacyPublic && !byLegacyPublic.empty) {
    const snap = byLegacyPublic.docs[0];
    if (ownedByOther(snap?.id, snap?.data() as Record<string, unknown>)) return false;
  }

  return true;
}

export async function isFirebaseUsernameAvailable(
  username: string,
  exceptUserId?: string | string[]
): Promise<boolean> {
  const db = getFirebaseFirestore();
  if (!db) return true;
  const normalized = username.trim().toLowerCase();
  const except = new Set(
    (Array.isArray(exceptUserId) ? exceptUserId : exceptUserId ? [exceptUserId] : [])
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const q = query(
    collection(db, 'profiles'),
    where('username', '==', normalized),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return true;
  const found = snap.docs[0].id;
  const data = snap.docs[0].data() as Record<string, unknown>;
  if (except.size === 0) return false;
  if (except.has(found)) return true;
  const linked =
    typeof data.linked_supabase_user_id === 'string'
      ? data.linked_supabase_user_id.trim()
      : '';
  return Boolean(linked && except.has(linked));
}

export async function fetchFirebaseProfilesByIds(userIds: string[]): Promise<ProfileRow[]> {
  const db = getFirebaseFirestore();
  if (!db || !userIds.length) return [];
  const unique = [...new Set(userIds.filter(Boolean))].slice(0, 40);
  const rows = await Promise.all(unique.map((id) => fetchFirebaseProfile(id)));
  return rows.filter((row): row is ProfileRow => row !== null);
}

let profileThoughtListenerStop: Unsubscribe | null = null;

export function subscribeFirebaseProfileThoughtUpdates(
  onRow: (row: ProfileRow) => void,
): () => void {
  const db = getFirebaseFirestore();
  if (!db) return () => undefined;

  profileThoughtListenerStop?.();
  const primed = { ready: false };
  profileThoughtListenerStop = onSnapshot(collection(db, 'profiles'), (snap) => {
    if (!primed.ready) {
      primed.ready = true;
      return;
    }
    snap.docChanges().forEach((change) => {
      if (change.type !== 'modified' && change.type !== 'added') return;
      const data = change.doc.data() as ProfileRow;
      if (data?.id || change.doc.id) {
        onRow({ ...data, id: data.id || change.doc.id });
      }
    });
  });

  return () => {
    profileThoughtListenerStop?.();
    profileThoughtListenerStop = null;
  };
}

export function userFromFirebaseUser(firebaseUser: FirebaseUser, profile: ProfileRow | null): User {
  if (profile) {
    const trimmedNote = (profile.note ?? '').trim();
    const noteUpdatedAt = profile.note_updated_at
      ? Date.parse(profile.note_updated_at)
      : undefined;
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
      ...(trimmedNote
        ? {
            note: trimmedNote,
            ...(Number.isFinite(noteUpdatedAt) ? { noteUpdatedAt } : {}),
          }
        : {}),
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

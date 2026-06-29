import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { User } from '../../types';
import {
  normalizePublicUserId,
  profileRowPublicUserIdChangedMs,
} from '../publicUserId';
import type { ProfileRow } from '../supabase/types';
import { getFirebaseFirestore } from './app';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

const SEARCH_LIMIT = 24;

function rowToUser(row: ProfileRow): User {
  return {
    id: row.id,
    publicUserId: row.public_user_id || row.username,
    publicUserIdChangedAt: profileRowPublicUserIdChangedMs(row),
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || DEFAULT_AVATAR,
    bio: row.bio || '',
    followers: 0,
    following: 0,
    status: 'none',
  };
}

function matchesTerm(row: ProfileRow, term: string): boolean {
  const haystack = [
    row.username,
    row.display_name,
    row.public_user_id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

/** Prefix search on Firestore profiles (username-ordered). */
export async function searchFirebaseProfiles(
  queryText: string,
  limitCount = SEARCH_LIMIT,
): Promise<User[]> {
  const db = getFirebaseFirestore();
  const term = queryText.trim().toLowerCase();
  if (!db || term.length < 1) return [];

  const end = term + '\uf8ff';
  const snap = await getDocs(
    query(
      collection(db, 'profiles'),
      orderBy('username'),
      where('username', '>=', term),
      where('username', '<=', end),
      limit(limitCount),
    ),
  );

  const hits = snap.docs
    .map((doc) => doc.data() as ProfileRow)
    .filter((row) => matchesTerm(row, term));

  const publicIdNorm = normalizePublicUserId(term);
  if (publicIdNorm && publicIdNorm !== term) {
    const byPublicId = await getDocs(
      query(
        collection(db, 'profiles'),
        where('public_user_id', '==', publicIdNorm),
        limit(1),
      ),
    );
    for (const doc of byPublicId.docs) {
      const row = doc.data() as ProfileRow;
      if (!hits.some((h) => h.id === row.id)) hits.push(row);
    }
  }

  return hits.slice(0, limitCount).map(rowToUser);
}

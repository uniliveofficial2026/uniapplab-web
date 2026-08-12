import { getFirebaseFirestore } from './app';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import { normalizePublicUserId } from '../publicUserId';

type ProfileLite = {
  id: string;
  username?: string;
  public_user_id?: string | null;
  updated_at?: string | null;
  source: 'profiles' | 'users';
};

function resolvedId(row: ProfileLite): string {
  const fromPublic = normalizePublicUserId(row.public_user_id || '');
  if (fromPublic) return fromPublic;
  return normalizePublicUserId(row.username || '');
}

function rankKeep(row: ProfileLite): number {
  let score = 0;
  // Prefer canonical `profiles` collection over legacy `users`.
  if (row.source === 'profiles') score += 100;
  if (row.public_user_id?.trim()) score += 10;
  if (row.username?.trim()) score += 1;
  return score;
}

async function readCollection(
  collectionName: 'profiles' | 'users',
): Promise<ProfileLite[]> {
  const db = getFirebaseFirestore();
  if (!db) return [];
  const snap = await getDocs(query(collection(db, collectionName), limit(500)));
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const username =
      (typeof data.username === 'string' && data.username) ||
      (typeof data.userName === 'string' && data.userName) ||
      undefined;
    const publicId =
      (typeof data.public_user_id === 'string' && data.public_user_id) ||
      (typeof data.publicUserId === 'string' && data.publicUserId) ||
      null;
    return {
      id: (typeof data.id === 'string' && data.id) || d.id,
      username,
      public_user_id: publicId,
      updated_at:
        (typeof data.updated_at === 'string' && data.updated_at) ||
        (typeof data.updatedAt === 'string' && data.updatedAt) ||
        null,
      source: collectionName,
    };
  });
}

/**
 * Hard purge duplicate public User IDs in Firestore.
 * Keeps one document per identity; DELETES the rest (prefers `profiles` over `users`).
 */
export async function dedupeFirebaseProfilePublicUserIds(): Promise<{
  scanned: number;
  deleted: number;
}> {
  const db = getFirebaseFirestore();
  if (!db) return { scanned: 0, deleted: 0 };

  const rows = [
    ...(await readCollection('profiles')),
    ...(await readCollection('users')),
  ];

  const groups = new Map<string, ProfileLite[]>();
  for (const row of rows) {
    const key = resolvedId(row);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let deleted = 0;

  for (const [, list] of groups) {
    // Collapse same auth id appearing in both collections to one row for ranking,
    // but still delete the weaker collection copy when identity is shared.
    const byAuth = new Map<string, ProfileLite[]>();
    for (const row of list) {
      const bucket = byAuth.get(row.id) ?? [];
      bucket.push(row);
      byAuth.set(row.id, bucket);
    }

    const distinctAuthIds = [...byAuth.keys()];
    if (distinctAuthIds.length <= 1) {
      // Same person in profiles + users: keep profiles, delete users copy.
      const copies = distinctAuthIds[0] ? byAuth.get(distinctAuthIds[0])! : [];
      if (copies.length > 1) {
        const ordered = [...copies].sort((a, b) => rankKeep(b) - rankKeep(a));
        for (const loser of ordered.slice(1)) {
          try {
            await deleteDoc(doc(db, loser.source, loser.id));
            deleted += 1;
          } catch (err) {
            console.warn('[identity] firebase delete failed', loser.source, loser.id, err);
          }
        }
      }
      continue;
    }

    const representatives = distinctAuthIds.map((id) => {
      const copies = byAuth.get(id)!;
      return [...copies].sort((a, b) => rankKeep(b) - rankKeep(a))[0]!;
    });

    const ordered = representatives.sort((a, b) => {
      const score = rankKeep(b) - rankKeep(a);
      if (score !== 0) return score;
      return String(a.updated_at || '').localeCompare(String(b.updated_at || ''));
    });

    const keeperAuthId = ordered[0]?.id;
    for (const loser of ordered.slice(1)) {
      // Delete every collection copy for losing auth ids.
      for (const copy of byAuth.get(loser.id) ?? [loser]) {
        try {
          await deleteDoc(doc(db, copy.source, copy.id));
          deleted += 1;
        } catch (err) {
          console.warn('[identity] firebase delete failed', copy.source, copy.id, err);
        }
      }
    }

    // For keeper, drop weaker collection duplicate if both exist.
    if (keeperAuthId) {
      const copies = byAuth.get(keeperAuthId) ?? [];
      if (copies.length > 1) {
        const orderedCopies = [...copies].sort((a, b) => rankKeep(b) - rankKeep(a));
        for (const extra of orderedCopies.slice(1)) {
          try {
            await deleteDoc(doc(db, extra.source, extra.id));
            deleted += 1;
          } catch (err) {
            console.warn('[identity] firebase delete failed', extra.source, extra.id, err);
          }
        }
      }
    }
  }

  return { scanned: rows.length, deleted };
}

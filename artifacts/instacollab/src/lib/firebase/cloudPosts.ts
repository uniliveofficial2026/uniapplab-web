import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { Post, User } from '../../types';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { postUserId } from '../safe';
import { fetchFirebaseProfile } from './profile';
import { profileRowToUser } from '../supabase/profile';
import { getFirebaseFirestore, getFirebaseStorage } from './app';
import { isFirebaseConfigured } from './config';
import {
  cloudRowToPost,
  type CloudPostRow,
} from '../supabase/cloudPosts';

const COLLECTION = 'posts';
const STORAGE_PREFIX = 'post-media';

function firestore() {
  return getFirebaseFirestore();
}

function postToPayload(post: Post): Record<string, unknown> {
  const { user: _user, ...rest } = post;
  return rest as Record<string, unknown>;
}

export function isFirebaseCloudPostsAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(firestore());
}

async function fetchAuthor(userId: string): Promise<User | null> {
  if (!isCloudAuthUserId(userId)) return null;
  const row = await fetchFirebaseProfile(userId).catch(() => null);
  return row ? profileRowToUser(row) : null;
}

export async function uploadFirebasePostMediaBlob(
  userId: string,
  postId: string,
  kind: 'image' | 'video' | 'audio' | 'cover',
  blob: Blob,
  fileName: string,
): Promise<string | null> {
  const storage = getFirebaseStorage();
  if (!storage || !isCloudAuthUserId(userId)) return null;

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || `${kind}.bin`;
  const path = `${STORAGE_PREFIX}/${userId}/${postId}/${kind}/${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || 'application/octet-stream',
  });
  return getDownloadURL(storageRef);
}

export async function upsertFirebaseCloudPost(post: Post): Promise<boolean> {
  const db = firestore();
  const authorId = postUserId(post);
  if (!db || !authorId || !isCloudAuthUserId(authorId)) return false;

  const now = post.createdAt || new Date().toISOString();
  await setDoc(
    doc(db, COLLECTION, post.id),
    {
      author_id: authorId,
      payload: postToPayload(post),
      is_archived: Boolean(post.isArchived),
      created_at: now,
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  );
  return true;
}

export async function deleteFirebaseCloudPost(
  postId: string,
  userId?: string,
): Promise<boolean> {
  const db = firestore();
  if (!db || !postId) return false;
  if (!userId || !isCloudAuthUserId(userId)) return false;

  const ref = doc(db, COLLECTION, postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return true;
  const authorId = String(snap.data()?.author_id ?? '');
  if (authorId !== userId) return false;

  await deleteDoc(ref);
  return true;
}

function rowFromDoc(id: string, data: Record<string, unknown>): CloudPostRow {
  return {
    id,
    author_id: String(data.author_id ?? ''),
    payload: (data.payload ?? {}) as Record<string, unknown>,
    is_archived: Boolean(data.is_archived),
    created_at: String(data.created_at ?? new Date().toISOString()),
    updated_at: String(data.updated_at ?? new Date().toISOString()),
  };
}

export async function fetchFirebaseCloudFeedPosts(limitCount = 60): Promise<Post[]> {
  const db = firestore();
  if (!db) return [];

  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('is_archived', '==', false),
      orderBy('created_at', 'desc'),
      limit(limitCount),
    ),
  );

  const rows = snap.docs.map((entry) => rowFromDoc(entry.id, entry.data()));
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const authors = new Map<string, User>();
  await Promise.all(
    authorIds.map(async (id) => {
      const author = await fetchAuthor(id);
      if (author) authors.set(id, author);
    }),
  );

  return rows
    .map((row) => {
      const author = authors.get(row.author_id);
      if (!author) return null;
      return cloudRowToPost(row, author);
    })
    .filter((post): post is Post => Boolean(post));
}

export async function fetchFirebaseCloudUserPosts(authorId: string, limitCount = 60): Promise<Post[]> {
  const db = firestore();
  if (!db || !isCloudAuthUserId(authorId)) return [];

  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('author_id', '==', authorId),
      orderBy('created_at', 'desc'),
      limit(limitCount),
    ),
  );

  const author = await fetchAuthor(authorId);
  if (!author) return [];

  return snap.docs
    .map((entry) => rowFromDoc(entry.id, entry.data()))
    .filter((row) => !row.is_archived)
    .map((row) => cloudRowToPost(row, author));
}

let postsListenerStop: Unsubscribe | null = null;

export function subscribeFirebaseCloudPosts(onChange: () => void): () => void {
  const db = firestore();
  if (!db) return () => undefined;

  postsListenerStop?.();
  postsListenerStop = onSnapshot(
    query(collection(db, COLLECTION), orderBy('updated_at', 'desc'), limit(80)),
    () => onChange(),
  );

  return () => {
    postsListenerStop?.();
    postsListenerStop = null;
  };
}

export function stopFirebaseCloudPostsListener(): void {
  postsListenerStop?.();
  postsListenerStop = null;
}

export async function fetchFirebaseCloudPostById(postId: string): Promise<CloudPostRow | null> {
  const db = firestore();
  if (!db || !postId) return null;
  const snap = await getDoc(doc(db, COLLECTION, postId));
  if (!snap.exists()) return null;
  return rowFromDoc(snap.id, snap.data());
}

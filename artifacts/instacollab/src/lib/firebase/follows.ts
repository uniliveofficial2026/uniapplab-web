import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

function db() {
  return getFirebaseFirestore();
}

export function isFirebaseFollowsAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(db());
}

function followDocId(followerId: string, followingId: string): string {
  return `${followerId}_${followingId}`;
}

function requestDocId(ownerId: string, requesterId: string): string {
  return `${ownerId}_${requesterId}`;
}

export async function fetchFirebaseFollowingIds(userId: string): Promise<string[]> {
  const firestore = db();
  if (!firestore || !userId) return [];
  const snap = await getDocs(
    query(collection(firestore, 'follows'), where('follower_id', '==', userId)),
  );
  return [...new Set(snap.docs.map((entry) => String(entry.data().following_id ?? '')).filter(Boolean))];
}

export async function fetchFirebaseFollowerIds(userId: string): Promise<string[]> {
  const firestore = db();
  if (!firestore || !userId) return [];
  const snap = await getDocs(
    query(collection(firestore, 'follows'), where('following_id', '==', userId)),
  );
  return [...new Set(snap.docs.map((entry) => String(entry.data().follower_id ?? '')).filter(Boolean))];
}

export async function insertFirebaseFollow(followerId: string, followingId: string): Promise<void> {
  const firestore = db();
  if (!firestore) throw new Error('Firebase is not configured');
  await setDoc(doc(firestore, 'follows', followDocId(followerId, followingId)), {
    follower_id: followerId,
    following_id: followingId,
    created_at: new Date().toISOString(),
  });
}

export async function deleteFirebaseFollow(followerId: string, followingId: string): Promise<void> {
  const firestore = db();
  if (!firestore) throw new Error('Firebase is not configured');
  await deleteDoc(doc(firestore, 'follows', followDocId(followerId, followingId)));
}

export async function insertFirebaseFollowRequest(ownerId: string, requesterId: string): Promise<void> {
  const firestore = db();
  if (!firestore) throw new Error('Firebase is not configured');
  await setDoc(doc(firestore, 'follow_requests', requestDocId(ownerId, requesterId)), {
    profile_owner_id: ownerId,
    requester_id: requesterId,
    created_at: new Date().toISOString(),
  });
}

export async function deleteFirebaseFollowRequest(ownerId: string, requesterId: string): Promise<void> {
  const firestore = db();
  if (!firestore) throw new Error('Firebase is not configured');
  await deleteDoc(doc(firestore, 'follow_requests', requestDocId(ownerId, requesterId)));
}

export async function fetchFirebasePendingFollowRequesterIds(ownerId: string): Promise<string[]> {
  const firestore = db();
  if (!firestore || !ownerId) return [];
  const snap = await getDocs(
    query(collection(firestore, 'follow_requests'), where('profile_owner_id', '==', ownerId)),
  );
  return [...new Set(snap.docs.map((entry) => String(entry.data().requester_id ?? '')).filter(Boolean))];
}

export async function hasFirebaseFollowRequest(ownerId: string, requesterId: string): Promise<boolean> {
  const firestore = db();
  if (!firestore) return false;
  const snap = await getDoc(doc(firestore, 'follow_requests', requestDocId(ownerId, requesterId)));
  return snap.exists();
}

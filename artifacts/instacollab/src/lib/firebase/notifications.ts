import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

export type FirebaseNotificationRow = {
  id: string;
  user_id: string;
  type: string;
  actor_id: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

function db() {
  return getFirebaseFirestore();
}

export function isFirebaseNotificationsAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(db());
}

export async function insertFirebaseUserNotification(input: {
  userId: string;
  type: string;
  actorId: string;
  body?: string;
}): Promise<void> {
  const firestore = db();
  if (!firestore) return;
  await addDoc(collection(firestore, 'user_notifications'), {
    user_id: input.userId,
    type: input.type,
    actor_id: input.actorId,
    body: input.body ?? null,
    read_at: null,
    created_at: new Date().toISOString(),
  });
}

export async function fetchFirebaseNotifications(userId: string, limitCount = 100): Promise<FirebaseNotificationRow[]> {
  const firestore = db();
  if (!firestore || !userId) return [];
  const snap = await getDocs(
    query(
      collection(firestore, 'user_notifications'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(limitCount),
    ),
  );
  return snap.docs.map((entry) => {
    const data = entry.data();
    return {
      id: entry.id,
      user_id: String(data.user_id ?? ''),
      type: String(data.type ?? 'system'),
      actor_id: (data.actor_id as string | null) ?? null,
      body: (data.body as string | null) ?? null,
      read_at: (data.read_at as string | null) ?? null,
      created_at: String(data.created_at ?? new Date().toISOString()),
    };
  });
}

export async function markFirebaseNotificationRead(notificationId: string, userId: string): Promise<void> {
  const firestore = db();
  if (!firestore || !notificationId) return;
  await updateDoc(doc(firestore, 'user_notifications', notificationId), {
    read_at: new Date().toISOString(),
  });
}

export async function markAllFirebaseNotificationsRead(userId: string): Promise<void> {
  const firestore = db();
  if (!firestore || !userId) return;
  const snap = await getDocs(
    query(
      collection(firestore, 'user_notifications'),
      where('user_id', '==', userId),
      where('read_at', '==', null),
      limit(200),
    ),
  );
  await Promise.all(
    snap.docs.map((entry) =>
      updateDoc(entry.ref, { read_at: new Date().toISOString() }),
    ),
  );
}

let listenerStop: Unsubscribe | null = null;

export function subscribeFirebaseNotifications(
  userId: string,
  onRow: (row: FirebaseNotificationRow) => void,
): () => void {
  const firestore = db();
  if (!firestore || !userId) return () => undefined;

  listenerStop?.();
  const primed = { ready: false };
  const q = query(
    collection(firestore, 'user_notifications'),
    where('user_id', '==', userId),
    orderBy('created_at', 'desc'),
    limit(100),
  );

  listenerStop = onSnapshot(q, (snap) => {
    if (!primed.ready) {
      primed.ready = true;
      return;
    }
    snap.docChanges().forEach((change) => {
      if (change.type === 'removed') return;
      const data = change.doc.data();
      onRow({
        id: change.doc.id,
        user_id: String(data.user_id ?? ''),
        type: String(data.type ?? 'system'),
        actor_id: (data.actor_id as string | null) ?? null,
        body: (data.body as string | null) ?? null,
        read_at: (data.read_at as string | null) ?? null,
        created_at: String(data.created_at ?? new Date().toISOString()),
      });
    });
  });

  return () => {
    listenerStop?.();
    listenerStop = null;
  };
}

export function stopFirebaseNotificationsListener(): void {
  listenerStop?.();
  listenerStop = null;
}

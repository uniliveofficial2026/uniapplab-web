import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

export type FirebaseProfileVisitRow = {
  id: string;
  owner_id: string;
  visitor_id: string;
  surface: string;
  content_id: string | null;
  preview_url: string | null;
  live_kind: string | null;
  visit_count: number;
  visited_at: string;
};

function db() {
  return getFirebaseFirestore();
}

export function isFirebaseProfileVisitsAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(db());
}

function visitDocId(ownerId: string, visitorId: string): string {
  return `${ownerId}_${visitorId}`;
}

export async function upsertFirebaseProfileVisit(input: {
  ownerId: string;
  visitorId: string;
  surface?: string;
  contentId?: string;
  previewUrl?: string;
  liveKind?: string;
}): Promise<void> {
  const firestore = db();
  if (!firestore) return;

  const ref = doc(firestore, 'profile_visits', visitDocId(input.ownerId, input.visitorId));
  const existing = await getDocs(
    query(
      collection(firestore, 'profile_visits'),
      where('owner_id', '==', input.ownerId),
      where('visitor_id', '==', input.visitorId),
      limit(1),
    ),
  );

  const payload = {
    owner_id: input.ownerId,
    visitor_id: input.visitorId,
    surface: input.surface ?? 'profile',
    content_id: input.contentId ?? null,
    preview_url: input.previewUrl ?? null,
    live_kind: input.liveKind ?? null,
    visited_at: new Date().toISOString(),
  };

  if (!existing.empty) {
    const row = existing.docs[0];
    const count = Number(row.data().visit_count ?? 0) + 1;
    await updateDoc(row.ref, { ...payload, visit_count: count });
    return;
  }

  await setDoc(ref, { ...payload, visit_count: 1 });
}

export async function fetchFirebaseProfileVisits(ownerId: string, limitCount = 100): Promise<FirebaseProfileVisitRow[]> {
  const firestore = db();
  if (!firestore || !ownerId) return [];
  const snap = await getDocs(
    query(
      collection(firestore, 'profile_visits'),
      where('owner_id', '==', ownerId),
      orderBy('visited_at', 'desc'),
      limit(limitCount),
    ),
  );
  return snap.docs.map((entry) => {
    const data = entry.data();
    return {
      id: entry.id,
      owner_id: String(data.owner_id ?? ''),
      visitor_id: String(data.visitor_id ?? ''),
      surface: String(data.surface ?? 'profile'),
      content_id: (data.content_id as string | null) ?? null,
      preview_url: (data.preview_url as string | null) ?? null,
      live_kind: (data.live_kind as string | null) ?? null,
      visit_count: Number(data.visit_count ?? 1),
      visited_at: String(data.visited_at ?? new Date().toISOString()),
    };
  });
}

let visitsListenerStop: Unsubscribe | null = null;

export function subscribeFirebaseProfileVisits(
  ownerId: string,
  onRow: (row: FirebaseProfileVisitRow) => void,
): () => void {
  const firestore = db();
  if (!firestore || !ownerId) return () => undefined;

  visitsListenerStop?.();
  const primed = { ready: false };
  const q = query(
    collection(firestore, 'profile_visits'),
    where('owner_id', '==', ownerId),
    orderBy('visited_at', 'desc'),
    limit(100),
  );

  visitsListenerStop = onSnapshot(q, (snap) => {
    if (!primed.ready) {
      primed.ready = true;
      return;
    }
    snap.docChanges().forEach((change) => {
      if (change.type === 'removed') return;
      const data = change.doc.data();
      onRow({
        id: change.doc.id,
        owner_id: String(data.owner_id ?? ''),
        visitor_id: String(data.visitor_id ?? ''),
        surface: String(data.surface ?? 'profile'),
        content_id: (data.content_id as string | null) ?? null,
        preview_url: (data.preview_url as string | null) ?? null,
        live_kind: (data.live_kind as string | null) ?? null,
        visit_count: Number(data.visit_count ?? 1),
        visited_at: String(data.visited_at ?? new Date().toISOString()),
      });
    });
  });

  return () => {
    visitsListenerStop?.();
    visitsListenerStop = null;
  };
}

export function stopFirebaseProfileVisitsListener(): void {
  visitsListenerStop?.();
  visitsListenerStop = null;
}

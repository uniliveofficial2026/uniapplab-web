import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { PartyRoomRow, PartyRoomUpsert } from '../supabase/partyRooms';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

function db() {
  return getFirebaseFirestore();
}

function rowFromSnap(id: string, data: Record<string, unknown>): PartyRoomRow {
  return {
    id,
    owner_id: String(data.owner_id ?? ''),
    room_name: String(data.room_name ?? ''),
    room_mode: String(data.room_mode ?? 'Chat'),
    privacy: String(data.privacy ?? 'Public'),
    join_policy: (data.join_policy as string | null) ?? null,
    cover_url: (data.cover_url as string | null) ?? null,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    max_participants: Number(data.max_participants ?? 50),
    participant_count: Number(data.participant_count ?? 0),
    status: (data.status as 'active' | 'ended') ?? 'active',
    created_at: typeof data.created_at === 'string' ? data.created_at : undefined,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : undefined,
  };
}

export function isFirebasePartyRoomsAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(db());
}

export async function upsertFirebasePartyRoom(row: PartyRoomUpsert): Promise<PartyRoomRow> {
  const firestore = db();
  if (!firestore) throw new Error('Firebase is not configured');

  const now = new Date().toISOString();
  const ref = doc(firestore, 'party_rooms', row.id);
  const existing = await getDoc(ref);
  const payload = {
    owner_id: row.owner_id,
    room_name: row.room_name,
    room_mode: row.room_mode ?? 'Chat',
    privacy: row.privacy ?? 'Public',
    join_policy: row.join_policy ?? null,
    cover_url: row.cover_url ?? null,
    tags: row.tags ?? [],
    max_participants: row.max_participants ?? 50,
    participant_count: row.participant_count ?? 0,
    status: row.status ?? 'active',
    created_at: existing.exists() ? (existing.data()?.created_at ?? now) : now,
    updated_at: now,
  };
  await setDoc(ref, payload, { merge: true });
  return rowFromSnap(row.id, payload);
}

export async function fetchFirebaseActivePartyRooms(limitCount = 40): Promise<PartyRoomRow[]> {
  const firestore = db();
  if (!firestore) return [];

  const q = query(
    collection(firestore, 'party_rooms'),
    where('status', '==', 'active'),
    orderBy('updated_at', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((entry) => rowFromSnap(entry.id, entry.data() as Record<string, unknown>));
}

export async function fetchFirebasePartyRoomById(roomId: string): Promise<PartyRoomRow | null> {
  const firestore = db();
  if (!firestore || !roomId) return null;
  const snap = await getDoc(doc(firestore, 'party_rooms', roomId));
  if (!snap.exists()) return null;
  return rowFromSnap(snap.id, snap.data() as Record<string, unknown>);
}

export async function fetchFirebaseOwnerActivePartyRoom(ownerId: string): Promise<PartyRoomRow | null> {
  const firestore = db();
  if (!firestore || !ownerId) return null;

  const q = query(
    collection(firestore, 'party_rooms'),
    where('owner_id', '==', ownerId),
    where('status', '==', 'active'),
    orderBy('updated_at', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  const first = snap.docs[0];
  if (!first) return null;
  return rowFromSnap(first.id, first.data() as Record<string, unknown>);
}

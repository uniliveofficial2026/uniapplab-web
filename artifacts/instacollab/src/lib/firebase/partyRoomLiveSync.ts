import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  ingestLiveRoomEventFromCloud,
  type LiveRoomEnvelope,
  type LiveRoomEventType,
} from '../livekit/liveRoomBus';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

function newEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export type FirebasePartyRoomSyncRow = {
  id: string;
  room_id: string;
  sender_id: string;
  event_type: LiveRoomEventType;
  payload: Record<string, unknown>;
  created_at: string;
};

function rowToEnvelope(row: FirebasePartyRoomSyncRow): LiveRoomEnvelope {
  const payload = row.payload ?? {};
  return {
    v: 1,
    id: row.id,
    type: row.event_type,
    roomId: row.room_id,
    senderId: row.sender_id,
    senderName: typeof payload.senderName === 'string' ? payload.senderName : undefined,
    ts: new Date(row.created_at).getTime(),
    payload,
  };
}

export function isFirebasePartyRoomLiveSyncAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(getFirebaseFirestore());
}

const seenFirebaseCloudIds = new Map<string, Set<string>>();

export async function insertFirebasePartyRoomSyncEvent(input: {
  roomId: string;
  senderId: string;
  senderName?: string;
  type: LiveRoomEventType;
  payload: Record<string, unknown>;
  /** Client-generated id so LiveKit + Firestore share one id for dedup. */
  id?: string;
}): Promise<FirebasePartyRoomSyncRow | null> {
  const db = getFirebaseFirestore();
  if (!db) return null;

  const body = {
    ...input.payload,
    ...(input.senderName ? { senderName: input.senderName } : {}),
  };

  const createdAt = new Date().toISOString();
  const id = input.id || newEventId();
  const ref = doc(collection(db, 'party_room_sync_events'), id);
  await setDoc(ref, {
    room_id: input.roomId,
    sender_id: input.senderId,
    event_type: input.type,
    payload: body,
    created_at: serverTimestamp(),
  });

  return {
    id,
    room_id: input.roomId,
    sender_id: input.senderId,
    event_type: input.type,
    payload: body,
    created_at: createdAt,
  };
}

/** Mark an event id as already handled so cloud echo is ignored. */
export function markFirebasePartyRoomSyncEventSeen(roomId: string, id: string): void {
  const seen = seenFirebaseCloudIds.get(roomId) ?? new Set<string>();
  seen.add(id);
  seenFirebaseCloudIds.set(roomId, seen);
}

export async function fetchRecentFirebasePartyRoomSyncEvents(
  roomId: string,
  limitCount = 50,
): Promise<LiveRoomEnvelope[]> {
  const db = getFirebaseFirestore();
  if (!db || !roomId) return [];

  const { getDocs } = await import('firebase/firestore');
  const q = query(
    collection(db, 'party_room_sync_events'),
    orderBy('created_at', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  const rows = snap.docs
    .map((entry) => {
      const data = entry.data();
      if (String(data.room_id ?? '') !== roomId) return null;
      return rowToEnvelope({
        id: entry.id,
        room_id: roomId,
        sender_id: String(data.sender_id ?? ''),
        event_type: data.event_type as LiveRoomEventType,
        payload: (data.payload ?? {}) as Record<string, unknown>,
        created_at:
          typeof data.created_at === 'string'
            ? data.created_at
            : new Date().toISOString(),
      });
    })
    .filter((row): row is LiveRoomEnvelope => row !== null);

  return rows.reverse();
}

export function subscribeFirebasePartyRoomSyncEvents(
  roomId: string,
  onEvent?: (event: LiveRoomEnvelope) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  if (!db || !roomId) return () => {};

  const seen = seenFirebaseCloudIds.get(roomId) ?? new Set<string>();
  seenFirebaseCloudIds.set(roomId, seen);

  const q = query(
    collection(db, 'party_room_sync_events'),
    orderBy('created_at', 'asc'),
  );

  let primed = false;
  return onSnapshot(q, (snap) => {
    if (!primed) {
      primed = true;
      return;
    }
    snap.docChanges().forEach((change) => {
      if (change.type !== 'added') return;
      const data = change.doc.data();
      if (String(data.room_id ?? '') !== roomId) return;
      const id = change.doc.id;
      if (seen.has(id)) return;
      seen.add(id);
      const envelope = rowToEnvelope({
        id,
        room_id: roomId,
        sender_id: String(data.sender_id ?? ''),
        event_type: data.event_type as LiveRoomEventType,
        payload: (data.payload ?? {}) as Record<string, unknown>,
        created_at:
          typeof data.created_at === 'string'
            ? data.created_at
            : new Date().toISOString(),
      });
      ingestLiveRoomEventFromCloud(envelope);
      onEvent?.(envelope);
    });
  });
}

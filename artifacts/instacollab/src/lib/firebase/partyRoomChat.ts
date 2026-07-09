import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  PartyRoomChatRow,
  PartyRoomLiveChatMessage,
} from '../supabase/partyRoomChat';
import {
  kindFromMessage,
  metaFromMessage,
  rowToLiveChatMessage,
} from '../supabase/partyRoomChat';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

export function isFirebasePartyRoomChatAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(getFirebaseFirestore());
}

export async function fetchFirebasePartyRoomMessages(
  roomId: string,
  limitCount = 50,
): Promise<PartyRoomLiveChatMessage[]> {
  const db = getFirebaseFirestore();
  if (!db || !roomId) return [];

  const { getDocs } = await import('firebase/firestore');
  const q = query(
    collection(db, 'party_rooms', roomId, 'messages'),
    orderBy('created_at', 'asc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((entry) => {
    const data = entry.data() as PartyRoomChatRow;
    return rowToLiveChatMessage({ ...data, id: entry.id, room_id: roomId });
  });
}

export async function insertFirebasePartyRoomMessage(
  roomId: string,
  senderId: string,
  senderName: string,
  message: PartyRoomLiveChatMessage,
): Promise<PartyRoomChatRow | null> {
  const db = getFirebaseFirestore();
  if (!db || !roomId || !senderId) return null;

  const payload = {
    room_id: roomId,
    sender_id: senderId,
    sender_name: senderName.trim() || message.user?.trim() || 'Guest',
    body: String(message.text ?? '').slice(0, 2000),
    kind: kindFromMessage(message),
    meta: metaFromMessage(message),
    created_at: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, 'party_rooms', roomId, 'messages'), {
    ...payload,
    created_at: serverTimestamp(),
  });

  return { ...payload, id: ref.id };
}

export function subscribeFirebasePartyRoomMessages(
  roomId: string,
  onInsert: (message: PartyRoomLiveChatMessage) => void,
): Unsubscribe | null {
  const db = getFirebaseFirestore();
  if (!db || !roomId) return null;

  const q = query(
    collection(db, 'party_rooms', roomId, 'messages'),
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
      const data = change.doc.data() as PartyRoomChatRow;
      onInsert(
        rowToLiveChatMessage({
          ...data,
          id: change.doc.id,
          room_id: roomId,
          created_at:
            typeof data.created_at === 'string'
              ? data.created_at
              : new Date().toISOString(),
        }),
      );
    });
  });
}

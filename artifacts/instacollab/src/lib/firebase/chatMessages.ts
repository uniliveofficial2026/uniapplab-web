import {
  addDoc,
  collection,
  doc,
  getDoc,
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
import type { ChatMessage } from '../dbTypes';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

export type FirebaseChatMessageRow = {
  id?: string;
  thread_id: string;
  sender_id: string;
  body: string;
  payload: Record<string, unknown>;
  client_id: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type FirebaseChatThreadRow = {
  id: string;
  member_ids: string[];
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ChatRealtimeHandlers = {
  onMessage: (row: FirebaseChatMessageRow) => void;
  onReaction?: (messageId: string) => void;
  onReadState?: (threadId: string, userId: string, lastReadAt: string) => void;
  onMembership?: () => void;
};

let inboxStop: (() => void) | null = null;
const messageUnsubs = new Map<string, Unsubscribe>();

function firestore() {
  return getFirebaseFirestore();
}

export function isFirebaseChatAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(firestore());
}

function nowIso(): string {
  return new Date().toISOString();
}

function messageToPayload(message: ChatMessage): Record<string, unknown> {
  return {
    id: message.id,
    text: message.text,
    from: message.from,
    media: message.media,
    location: message.location,
    replyTo: message.replyTo,
    replyToMany: message.replyToMany,
    reactionState: message.reactionState,
    timestamp: message.timestamp,
    isCallEvent: message.isCallEvent,
    callKind: message.callKind,
    callAction: message.callAction,
    callRoomName: message.callRoomName,
  };
}

function bodyFromMessage(message: ChatMessage): string {
  if (message.isCallEvent) {
    const kind = message.callKind === 'video' ? 'Video' : 'Audio';
    if (message.callAction === 'end') return `${kind} call ended`;
    if (message.callAction === 'decline') return `${kind} call declined`;
    return `${kind} call`;
  }
  const text = String(message.text ?? '').trim();
  if (text) return text.slice(0, 8000);
  if (message.location) return '📍 Location';
  const media = Array.isArray(message.media) ? message.media : [];
  if (media.length) {
    const first = media[0] as { isAudio?: boolean; isVideo?: boolean; isFile?: boolean; name?: string };
    if (first?.isAudio) return '🎵 Audio';
    if (first?.isVideo) return '🎬 Video';
    if (first?.isFile) return first.name ? `📄 ${first.name}` : '📄 File';
    return '📷 Photo';
  }
  return 'Message';
}

export async function findFirebaseDmThread(meId: string, peerId: string): Promise<string | null> {
  const db = firestore();
  if (!db) return null;

  const snap = await getDocs(
    query(collection(db, 'chat_threads'), where('member_ids', 'array-contains', meId)),
  );
  for (const entry of snap.docs) {
    const data = entry.data() as FirebaseChatThreadRow;
    const members = Array.isArray(data.member_ids) ? data.member_ids : [];
    const meta = (data.meta ?? {}) as { kind?: string };
    if (meta.kind === 'group') continue;
    if (members.length === 2 && members.includes(peerId)) return entry.id;
  }
  return null;
}

export async function createFirebaseChatThread(
  memberIds: string[],
  meta: Record<string, unknown> = {},
): Promise<string | null> {
  const db = firestore();
  if (!db) return null;

  const unique = [...new Set(memberIds.filter(Boolean))];
  if (unique.length < 2) return null;

  const ref = doc(collection(db, 'chat_threads'));
  const now = nowIso();
  await setDoc(ref, {
    member_ids: unique,
    meta,
    created_at: now,
    updated_at: now,
  });
  return ref.id;
}

export async function updateFirebaseThreadMeta(
  threadId: string,
  meta: Record<string, unknown>,
): Promise<void> {
  const db = firestore();
  if (!db || !threadId) return;
  await updateDoc(doc(db, 'chat_threads', threadId), {
    meta,
    updated_at: nowIso(),
  });
}

export async function fetchFirebaseThread(threadId: string): Promise<FirebaseChatThreadRow | null> {
  const db = firestore();
  if (!db || !threadId) return null;

  const snap = await getDoc(doc(db, 'chat_threads', threadId));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<FirebaseChatThreadRow, 'id'>;
  return { ...data, id: snap.id };
}

export async function updateFirebaseThreadMembers(
  threadId: string,
  memberIds: string[],
  meta?: Record<string, unknown>,
): Promise<void> {
  const db = firestore();
  if (!db || !threadId) return;

  const patch: Record<string, unknown> = {
    member_ids: [...new Set(memberIds.filter(Boolean))],
    updated_at: nowIso(),
  };
  if (meta) patch.meta = meta;
  await updateDoc(doc(db, 'chat_threads', threadId), patch);
}

export async function listFirebaseThreadsForUser(meId: string): Promise<FirebaseChatThreadRow[]> {
  const db = firestore();
  if (!db) return [];

  const snap = await getDocs(
    query(collection(db, 'chat_threads'), where('member_ids', 'array-contains', meId)),
  );
  return snap.docs.map((entry) => {
    const data = entry.data() as Omit<FirebaseChatThreadRow, 'id'>;
    return { ...data, id: entry.id };
  });
}

export async function insertFirebaseChatMessage(
  threadId: string,
  message: ChatMessage,
  meId: string,
): Promise<string | null> {
  const db = firestore();
  if (!db || !threadId) return null;

  const clientId = message.id ? String(message.id) : null;
  if (clientId) {
    const existing = await getDocs(
      query(
        collection(db, 'chat_threads', threadId, 'messages'),
        where('client_id', '==', clientId),
        limit(1),
      ),
    );
    if (!existing.empty) return existing.docs[0].id;
  }

  const createdAt = nowIso();
  const ref = await addDoc(collection(db, 'chat_threads', threadId, 'messages'), {
    sender_id: meId,
    body: bodyFromMessage(message),
    payload: messageToPayload(message),
    client_id: clientId,
    deleted_at: null,
    created_at: createdAt,
  });

  await updateDoc(doc(db, 'chat_threads', threadId), { updated_at: createdAt });
  return ref.id;
}

export async function fetchFirebaseChatMessages(
  threadId: string,
  limitCount = 200,
): Promise<FirebaseChatMessageRow[]> {
  const db = firestore();
  if (!db) return [];

  const snap = await getDocs(
    query(
      collection(db, 'chat_threads', threadId, 'messages'),
      orderBy('created_at', 'asc'),
      limit(limitCount),
    ),
  );

  return snap.docs.map((entry) => {
    const data = entry.data();
    return {
      id: entry.id,
      thread_id: threadId,
      sender_id: String(data.sender_id ?? ''),
      body: String(data.body ?? ''),
      payload: (data.payload ?? {}) as Record<string, unknown>,
      client_id: typeof data.client_id === 'string' ? data.client_id : null,
      deleted_at: typeof data.deleted_at === 'string' ? data.deleted_at : null,
      created_at:
        typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
    };
  });
}

export async function updateFirebaseChatMessage(
  threadId: string,
  cloudId: string,
  body: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = firestore();
  if (!db) return;
  await updateDoc(doc(db, 'chat_threads', threadId, 'messages', cloudId), {
    body,
    payload,
  });
}

export async function softDeleteFirebaseChatMessage(threadId: string, cloudId: string): Promise<void> {
  const db = firestore();
  if (!db) return;
  await updateDoc(doc(db, 'chat_threads', threadId, 'messages', cloudId), {
    deleted_at: nowIso(),
    body: 'Message deleted',
    payload: {},
  });
}

export async function upsertFirebaseReadReceipt(
  threadId: string,
  userId: string,
  timestamp: number,
): Promise<void> {
  const db = firestore();
  if (!db) return;
  await setDoc(doc(db, 'chat_threads', threadId, 'read_state', userId), {
    last_read_at: new Date(timestamp).toISOString(),
  });
}

export async function fetchFirebaseReadReceipts(
  threadId: string,
): Promise<Array<{ user_id: string; last_read_at: string }>> {
  const db = firestore();
  if (!db) return [];
  const snap = await getDocs(collection(db, 'chat_threads', threadId, 'read_state'));
  return snap.docs.map((entry) => {
    const data = entry.data();
    return {
      user_id: entry.id,
      last_read_at: String(data.last_read_at ?? ''),
    };
  });
}

export async function setFirebaseReaction(
  threadId: string,
  messageId: string,
  userId: string,
  emoji: string | null,
): Promise<void> {
  const db = firestore();
  if (!db) return;
  const ref = doc(db, 'chat_threads', threadId, 'reactions', `${messageId}_${userId}`);
  if (!emoji) {
    const existing = await getDoc(ref);
    if (existing.exists()) await updateDoc(ref, { emoji: null, deleted: true });
    return;
  }
  await setDoc(ref, { message_id: messageId, user_id: userId, emoji, deleted: false });
}

export async function fetchFirebaseReactionsForThread(
  threadId: string,
  messageIds: string[],
): Promise<Array<{ message_id: string; user_id: string; emoji: string }>> {
  const db = firestore();
  if (!db || messageIds.length === 0) return [];

  const snap = await getDocs(collection(db, 'chat_threads', threadId, 'reactions'));
  const allowed = new Set(messageIds);
  return snap.docs
    .map((entry) => {
      const data = entry.data();
      if (data.deleted) return null;
      const messageId = String(data.message_id ?? '');
      const emoji = String(data.emoji ?? '');
      if (!messageId || !emoji || !allowed.has(messageId)) return null;
      return {
        message_id: messageId,
        user_id: String(data.user_id ?? ''),
        emoji,
      };
    })
    .filter((row): row is { message_id: string; user_id: string; emoji: string } => row !== null);
}

function bindMessageListener(threadId: string, handlers: ChatRealtimeHandlers, primed: Set<string>) {
  const db = firestore();
  if (!db) return;

  if (messageUnsubs.has(threadId)) return;

  const q = query(
    collection(db, 'chat_threads', threadId, 'messages'),
    orderBy('created_at', 'asc'),
  );

  const unsub = onSnapshot(q, (snap) => {
    const key = `messages:${threadId}`;
    if (!primed.has(key)) {
      primed.add(key);
      return;
    }
    snap.docChanges().forEach((change) => {
      if (change.type !== 'added' && change.type !== 'modified') return;
      const data = change.doc.data();
      handlers.onMessage({
        id: change.doc.id,
        thread_id: threadId,
        sender_id: String(data.sender_id ?? ''),
        body: String(data.body ?? ''),
        payload: (data.payload ?? {}) as Record<string, unknown>,
        client_id: typeof data.client_id === 'string' ? data.client_id : null,
        deleted_at: typeof data.deleted_at === 'string' ? data.deleted_at : null,
        created_at:
          typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
      });
    });
  });

  messageUnsubs.set(threadId, unsub);
}

function bindReactionListener(threadId: string, handlers: ChatRealtimeHandlers, primed: Set<string>) {
  const db = firestore();
  if (!db || !handlers.onReaction) return;
  if (messageUnsubs.has(`reactions:${threadId}`)) return;

  const unsub = onSnapshot(collection(db, 'chat_threads', threadId, 'reactions'), (snap) => {
    const key = `reactions:${threadId}`;
    if (!primed.has(key)) {
      primed.add(key);
      return;
    }
    snap.docChanges().forEach((change) => {
      if (change.type === 'removed') return;
      const data = change.doc.data();
      if (data.deleted) return;
      const messageId = String(data.message_id ?? '');
      if (messageId) handlers.onReaction?.(messageId);
    });
  });
  messageUnsubs.set(`reactions:${threadId}`, unsub);
}

function bindReadListener(threadId: string, handlers: ChatRealtimeHandlers, primed: Set<string>) {
  const db = firestore();
  if (!db || !handlers.onReadState) return;
  if (messageUnsubs.has(`read:${threadId}`)) return;

  const unsub = onSnapshot(collection(db, 'chat_threads', threadId, 'read_state'), (snap) => {
    const key = `read:${threadId}`;
    if (!primed.has(key)) {
      primed.add(key);
      return;
    }
    snap.docChanges().forEach((change) => {
      if (change.type === 'removed') return;
      const data = change.doc.data();
      handlers.onReadState?.(
        threadId,
        change.doc.id,
        String(data.last_read_at ?? ''),
      );
    });
  });
  messageUnsubs.set(`read:${threadId}`, unsub);
}

function syncThreadListeners(
  threadIds: string[],
  handlers: ChatRealtimeHandlers,
  primed: Set<string>,
) {
  const next = new Set(threadIds);
  for (const [key, unsub] of messageUnsubs.entries()) {
    const threadId = key.split(':').pop() ?? key;
    if (!next.has(threadId)) {
      unsub();
      messageUnsubs.delete(key);
    }
  }
  for (const threadId of next) {
    bindMessageListener(threadId, handlers, primed);
    bindReactionListener(threadId, handlers, primed);
    bindReadListener(threadId, handlers, primed);
  }
}

export function startFirebaseChatRealtime(
  meId: string,
  handlers: ChatRealtimeHandlers,
): () => void {
  stopFirebaseChatRealtime();

  const db = firestore();
  if (!db || !meId) return () => undefined;

  const primed = new Set<string>();
  const threadsQuery = query(
    collection(db, 'chat_threads'),
    where('member_ids', 'array-contains', meId),
  );

  const unsubThreads = onSnapshot(threadsQuery, (snap) => {
  if (!primed.has('threads')) {
      primed.add('threads');
      const threadIds = snap.docs.map((entry) => entry.id);
      syncThreadListeners(threadIds, handlers, primed);
      handlers.onMembership?.();
      return;
    }
    snap.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        syncThreadListeners(snap.docs.map((entry) => entry.id), handlers, primed);
        handlers.onMembership?.();
      }
    });
  });

  inboxStop = () => {
    unsubThreads();
    for (const unsub of messageUnsubs.values()) unsub();
    messageUnsubs.clear();
    inboxStop = null;
  };

  return inboxStop;
}

export function stopFirebaseChatRealtime(): void {
  inboxStop?.();
  inboxStop = null;
}

import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '../db/localDb';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { createChatThread, sendChatMessageApi, isPlatformApiAvailable } from '../platformApi';
import type { ChatMessage } from '../dbTypes';

type ThreadMap = Record<string, string>;

let realtimeChannel: RealtimeChannel | null = null;

function threadMapKey(): string {
  return 'chat_cloud_thread_map';
}

function loadThreadMap(): ThreadMap {
  return db.load<ThreadMap>(threadMapKey(), {}) || {};
}

function saveThreadMap(map: ThreadMap): void {
  db.save(threadMapKey(), map);
}

export async function ensureCloudThreadForPeer(peerId: string): Promise<string | null> {
  if (!isPlatformApiAvailable() || !isCloudAuthUserId(peerId)) return null;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return null;

  const map = loadThreadMap();
  if (map[peerId]) return map[peerId];

  try {
    const thread = await createChatThread([peerId]);
    map[peerId] = thread.id;
    saveThreadMap(map);
    return thread.id;
  } catch {
    return null;
  }
}

export function queueCloudMessageSend(chatId: string, message: ChatMessage): void {
  const text = String(message.text ?? '').trim();
  if (!text || !message.isAuthor) return;
  if (!isPlatformApiAvailable()) return;

  void (async () => {
    const threadId = await ensureCloudThreadForPeer(chatId);
    if (!threadId) return;
    try {
      await sendChatMessageApi(threadId, text);
    } catch {
      // local message already saved; cloud send can retry later
    }
  })();
}

function mergeRemoteMessage(peerId: string, body: string, createdAt: string, senderId: string): void {
  const meId = db.currentUserId;
  if (!meId) return;
  const isAuthor = senderId === meId;
  // Own sends are already in IDB; Realtime echo would re-trigger cloud send + render storms.
  if (isAuthor) return;
  // 1:1 chats are keyed by peer id — ignore inserts from unrelated senders.
  if (senderId !== peerId) return;
  const msgs = db.messages[peerId] || [];
  const ts = Date.parse(createdAt) || Date.now();
  const exists = msgs.some(
    (m: ChatMessage) =>
      m.text === body && Math.abs(Number(m.timestamp ?? 0) - ts) < 2000,
  );
  if (exists) return;

  db.addMessage(peerId, {
    text: body,
    isAuthor: false,
    timestamp: ts,
  });
}

export async function startCloudChatRealtime(userId: string): Promise<void> {
  stopCloudChatRealtime();
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  realtimeChannel = supabase
    .channel(`chat-messages:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as {
          sender_id?: string;
          body?: string;
          created_at?: string;
          thread_id?: string;
        };
        if (!row?.body || !row.thread_id) return;

        const map = loadThreadMap();
        const peerId = Object.entries(map).find(([, tid]) => tid === row.thread_id)?.[0];
        if (!peerId) return;
        mergeRemoteMessage(peerId, row.body, row.created_at ?? new Date().toISOString(), row.sender_id ?? '');
      },
    )
    .subscribe();
}

export function stopCloudChatRealtime(): void {
  const supabase = getSupabaseClient();
  if (realtimeChannel && supabase) {
    void supabase.removeChannel(realtimeChannel);
  }
  realtimeChannel = null;
}

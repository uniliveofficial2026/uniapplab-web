import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '../db/localDb';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { fetchProfile, profileRowToUser } from '../supabase/profile';
import { createChatThread, sendChatMessageApi, isPlatformApiAvailable } from '../platformApi';
import type { ChatMessage } from '../dbTypes';
import type { ChatGroup } from '../../types';
import { cloudifyChatMessageMedia } from './chatMediaUpload';

type ThreadMap = Record<string, string>;

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

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

function rememberThreadPeer(peerId: string, threadId: string): void {
  const map = loadThreadMap();
  if (map[peerId] === threadId) return;
  map[peerId] = threadId;
  saveThreadMap(map);
}

async function ensurePeerProfileCached(peerId: string): Promise<void> {
  if (!isCloudAuthUserId(peerId)) return;
  if (db.users.some((user) => user.id === peerId)) return;
  const row = await fetchProfile(peerId).catch(() => null);
  if (row) {
    db.cacheDiscoveredUsers([profileRowToUser(row)]);
    return;
  }
  db.cacheDiscoveredUsers([
    {
      id: peerId,
      username: `@${peerId.slice(0, 8)}`,
      displayName: 'User',
      avatarUrl: DEFAULT_AVATAR,
      bio: '',
      followers: 0,
      following: 0,
    },
  ]);
}

async function findExistingCloudThread(peerId: string, meId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: myMemberships, error } = await supabase
    .from('chat_thread_members')
    .select('thread_id')
    .eq('user_id', meId);
  if (error || !myMemberships?.length) return null;

  const myThreadIds = myMemberships.map((row) => row.thread_id).filter(Boolean);
  if (myThreadIds.length === 0) return null;

  const { data: sharedMemberships, error: sharedErr } = await supabase
    .from('chat_thread_members')
    .select('thread_id')
    .eq('user_id', peerId)
    .in('thread_id', myThreadIds);
  if (sharedErr || !sharedMemberships?.length) return null;

  return sharedMemberships[0]?.thread_id ?? null;
}

async function createCloudThreadDirect(peerId: string, meId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: thread, error: threadErr } = await supabase
    .from('chat_threads')
    .insert({})
    .select('id')
    .single();
  if (threadErr || !thread?.id) {
    console.warn('[cloud-chat] direct thread create failed:', threadErr?.message);
    return null;
  }

  const { error: memberErr } = await supabase.from('chat_thread_members').insert([
    { thread_id: thread.id, user_id: meId },
    { thread_id: thread.id, user_id: peerId },
  ]);
  if (memberErr) {
    console.warn('[cloud-chat] direct thread members failed:', memberErr.message);
    return null;
  }

  return thread.id;
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

function isGroupChatId(chatId: string): boolean {
  return chatId.startsWith('group') || chatId.startsWith('group_');
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

function payloadToMessage(
  payload: Record<string, unknown> | null | undefined,
  body: string,
  isAuthor: boolean,
  createdAt: string,
  cloudId?: string,
  senderId?: string,
): ChatMessage {
  const base = (payload && typeof payload === 'object' ? payload : {}) as ChatMessage;
  return {
    ...base,
    id: String(base.id || cloudId || ''),
    cloudId,
    text: String(base.text ?? body ?? ''),
    from: base.from || senderId,
    media: base.media,
    location: base.location,
    replyTo: base.replyTo,
    replyToMany: base.replyToMany,
    reactionState: base.reactionState,
    isCallEvent: base.isCallEvent,
    callKind: base.callKind,
    callAction: base.callAction,
    callRoomName: base.callRoomName,
    isAuthor,
    timestamp: Date.parse(createdAt) || Number(base.timestamp) || Date.now(),
  };
}

async function sendChatMessageDirect(
  threadId: string,
  message: ChatMessage,
  meId: string,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const body = bodyFromMessage(message);
  const row = {
    thread_id: threadId,
    sender_id: meId,
    body,
    payload: messageToPayload(message),
    client_id: message.id ?? null,
  };

  const { data, error } = await supabase.from('chat_messages').insert(row).select('id').maybeSingle();
  if (!error) return data?.id ?? null;

  // Idempotent retry when client_id already exists for this thread.
  if (message.id) {
    const { data: existing } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('thread_id', threadId)
      .eq('client_id', message.id)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from('chat_messages')
        .update({ body: row.body, payload: row.payload })
        .eq('id', existing.id);
      return existing.id;
    }
  }

  console.warn('[cloud-chat] direct send failed:', error.message);
  return null;
}

async function hydrateThreadMapFromCloud(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: myMemberships, error } = await supabase
    .from('chat_thread_members')
    .select('thread_id')
    .eq('user_id', userId);
  if (error || !myMemberships?.length) return;

  const map = loadThreadMap();
  let changed = false;

  for (const { thread_id: threadId } of myMemberships) {
    if (!threadId) continue;
    if (Object.values(map).includes(threadId)) continue;

    const { data: threadRow } = await supabase
      .from('chat_threads')
      .select('id, meta')
      .eq('id', threadId)
      .maybeSingle();

    const { data: members, error: membersErr } = await supabase
      .from('chat_thread_members')
      .select('user_id')
      .eq('thread_id', threadId);
    if (membersErr || !members?.length) continue;

    const peers = members.map((row) => row.user_id).filter((id) => id && id !== userId);
    const meta = (threadRow?.meta ?? {}) as {
      kind?: string;
      localId?: string;
      title?: string;
      avatarUrl?: string;
    };

    if (peers.length === 1 && meta.kind !== 'group') {
      map[peers[0]] = threadId;
      changed = true;
      continue;
    }

    if (peers.length >= 1 && (meta.kind === 'group' || peers.length >= 2)) {
      const localId = meta.localId || `group_cloud_${threadId.slice(0, 8)}`;
      map[localId] = threadId;
      changed = true;
      db.mergeInboundChatGroup({
        id: localId,
        displayName: meta.title || 'Group chat',
        username: `${peers.length + 1} members`,
        avatarUrl:
          meta.avatarUrl ||
          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100',
        isGroup: true,
        memberIds: [userId, ...peers],
        createdBy: userId,
        adminIds: [userId],
        mutedMemberIds: [],
        adminOnlyPosting: false,
        requireApprovalToJoin: false,
      });
    }
  }

  if (changed) saveThreadMap(map);
}

function resolvePeerIdForThread(threadId: string, senderId: string): string | null {
  const meId = db.currentUserId;
  if (!meId) return null;

  const map = loadThreadMap();
  let peerId = Object.entries(map).find(([, tid]) => tid === threadId)?.[0] ?? null;

  if (!peerId && senderId && senderId !== meId && isCloudAuthUserId(senderId)) {
    peerId = senderId;
    rememberThreadPeer(peerId, threadId);
  }

  return peerId;
}

export async function ensureCloudThreadForGroup(group: ChatGroup): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return null;

  const map = loadThreadMap();
  if (map[group.id]) return map[group.id];

  const memberIds = [
    ...new Set(
      (group.memberIds || [])
        .map((id) => String(id || '').trim())
        .filter((id) => isCloudAuthUserId(id)),
    ),
  ];
  if (!memberIds.includes(meId)) memberIds.push(meId);
  if (memberIds.length < 2) return null;

  try {
    const thread = await createChatThread(memberIds.filter((id) => id !== meId));
    rememberThreadPeer(group.id, thread.id);
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase
        .from('chat_threads')
        .update({
          meta: {
            kind: 'group',
            localId: group.id,
            title: group.displayName,
            avatarUrl: group.avatarUrl,
          },
        })
        .eq('id', thread.id);
    }
    return thread.id;
  } catch (apiErr) {
    console.warn('[cloud-chat] group thread create failed:', apiErr);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: thread, error: threadErr } = await supabase
    .from('chat_threads')
    .insert({
      meta: {
        kind: 'group',
        localId: group.id,
        title: group.displayName,
        avatarUrl: group.avatarUrl,
      },
    })
    .select('id')
    .single();
  if (threadErr || !thread?.id) return null;

  const { error: memberErr } = await supabase.from('chat_thread_members').insert(
    memberIds.map((user_id) => ({ thread_id: thread.id, user_id })),
  );
  if (memberErr) {
    console.warn('[cloud-chat] group members failed:', memberErr.message);
    return null;
  }
  rememberThreadPeer(group.id, thread.id);
  return thread.id;
}

export async function ensureCloudThreadForChat(chatId: string): Promise<string | null> {
  if (isGroupChatId(chatId)) {
    const group = db.getChatGroup(chatId);
    if (!group) return null;
    return ensureCloudThreadForGroup(group);
  }
  return ensureCloudThreadForPeer(chatId);
}

export async function ensureCloudThreadForPeer(peerId: string): Promise<string | null> {
  if ((!isPlatformApiAvailable() && !isSupabaseConfigured()) || !isCloudAuthUserId(peerId)) return null;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return null;

  const map = loadThreadMap();
  if (map[peerId]) return map[peerId];

  const existing = await findExistingCloudThread(peerId, meId);
  if (existing) {
    rememberThreadPeer(peerId, existing);
    return existing;
  }

  try {
    const thread = await createChatThread([peerId]);
    rememberThreadPeer(peerId, thread.id);
    return thread.id;
  } catch (apiErr) {
    console.warn('[cloud-chat] API thread create failed, trying direct:', apiErr);
  }

  const direct = await createCloudThreadDirect(peerId, meId);
  if (direct) {
    rememberThreadPeer(peerId, direct);
    return direct;
  }

  return null;
}

export function queueCloudMessageSend(chatId: string, message: ChatMessage): void {
  if (!message.isAuthor) return;
  if (!isPlatformApiAvailable() && !isSupabaseConfigured()) return;
  const hasContent =
    String(message.text ?? '').trim() ||
    (Array.isArray(message.media) && message.media.length > 0) ||
    !!message.location ||
    !!message.isCallEvent;
  if (!hasContent) return;

  void (async () => {
    const meId = db.currentUserId;
    if (!meId || !isCloudAuthUserId(meId)) return;
    if (!isGroupChatId(chatId) && !isCloudAuthUserId(chatId)) return;

    const threadId = await ensureCloudThreadForChat(chatId);
    if (!threadId) return;

    const withMedia = await cloudifyChatMessageMedia(meId, {
      ...message,
      from: message.from || meId,
    });
    const cloudId = await sendChatMessageDirect(threadId, withMedia, meId);
    if (cloudId && withMedia.id) {
      db.attachCloudMessageId(chatId, String(withMedia.id), cloudId);
      // Refresh local media URLs to public cloud URLs after upload.
      db.mergeInboundMessage(chatId, { ...withMedia, cloudId, isAuthor: true }, { bumpUnread: false });
      return;
    }

    try {
      await sendChatMessageApi(threadId, bodyFromMessage(withMedia));
    } catch (apiErr) {
      console.warn('[cloud-chat] API send failed:', apiErr);
    }
  })();
}

function mergeRemoteMessage(
  chatId: string,
  row: {
    id?: string;
    body?: string;
    payload?: Record<string, unknown> | null;
    created_at?: string;
    sender_id?: string;
    client_id?: string | null;
    deleted_at?: string | null;
  },
): void {
  const meId = db.currentUserId;
  if (!meId) return;
  const senderId = row.sender_id ?? '';
  const isAuthor = senderId === meId;
  // Own sends are already in IDB; Realtime echo would re-trigger cloud send + render storms.
  if (isAuthor) {
    if (row.id && (row.client_id || row.payload?.id)) {
      db.attachCloudMessageId(chatId, String(row.client_id || row.payload?.id), row.id);
    }
    return;
  }
  // 1:1 chats are keyed by peer id — ignore inserts from unrelated senders.
  // Group chats are keyed by group id — any member may send.
  if (!isGroupChatId(chatId) && senderId !== chatId) return;

  if (row.deleted_at) {
    if (row.id) db.markCloudMessageDeleted(chatId, row.id);
    return;
  }

  const msg = payloadToMessage(
    row.payload,
    row.body ?? '',
    false,
    row.created_at ?? new Date().toISOString(),
    row.id,
    senderId,
  );
  if (row.client_id) msg.id = row.client_id;

  if (isCloudAuthUserId(senderId)) void ensurePeerProfileCached(senderId);
  db.mergeInboundMessage(chatId, msg, { bumpUnread: !msg.isCallEvent });

  if (msg.isCallEvent && msg.callAction === 'invite' && msg.callRoomName) {
    window.dispatchEvent(
      new CustomEvent('chat-call-invite', {
        detail: {
          chatId,
          fromUserId: senderId,
          callKind: msg.callKind === 'video' ? 'video' : 'audio',
          callRoomName: msg.callRoomName,
          threadId: loadThreadMap()[chatId],
        },
      }),
    );
  }
}

export async function syncCloudChatHistory(peerId: string): Promise<void> {
  if ((!isPlatformApiAvailable() && !isSupabaseConfigured()) || !isCloudAuthUserId(peerId)) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const threadId = await ensureCloudThreadForPeer(peerId);
  if (!threadId) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender_id, body, payload, client_id, deleted_at, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error || !data?.length) return;

  await ensurePeerProfileCached(peerId);
  for (const row of data) {
    if (!row.sender_id) continue;
    mergeRemoteMessage(peerId, row);
  }

  await syncCloudReactionsForThread(threadId, peerId);
  await syncCloudReadReceipt(peerId, threadId, meId);
}

async function syncCloudReactionsForThread(threadId: string, peerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, client_id, payload')
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .limit(200);
  if (!messages?.length) return;

  const messageIds = messages.map((m) => m.id).filter(Boolean);
  if (!messageIds.length) return;

  const { data: reactions } = await supabase
    .from('chat_message_reactions')
    .select('message_id, user_id, emoji')
    .in('message_id', messageIds);
  if (!reactions?.length) return;

  const byMessage = new Map<string, { counts: Record<string, number>; selected: string | null }>();
  const meId = db.currentUserId;
  for (const row of reactions) {
    const entry = byMessage.get(row.message_id) ?? { counts: {}, selected: null };
    entry.counts[row.emoji] = (entry.counts[row.emoji] || 0) + 1;
    if (row.user_id === meId) entry.selected = row.emoji;
    byMessage.set(row.message_id, entry);
  }

  for (const msg of messages) {
    const state = byMessage.get(msg.id);
    if (!state) continue;
    const localId = String(msg.client_id || (msg.payload as { id?: string } | null)?.id || msg.id);
    db.applyInboundMessageReaction(peerId, localId, state);
  }
}

async function syncCloudReadReceipt(
  peerId: string,
  threadId: string,
  meId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data } = await supabase
    .from('chat_read_state')
    .select('user_id, last_read_at')
    .eq('thread_id', threadId);
  if (!data?.length) return;
  for (const row of data) {
    const ts = Date.parse(row.last_read_at) || 0;
    if (!ts) continue;
    if (row.user_id === peerId) {
      db.setChatPeerReadAt(peerId, ts);
    } else if (row.user_id === meId) {
      db.setChatReadAt(peerId, ts, { skipCloud: true });
    }
  }
}

export function queueCloudReadReceipt(peerId: string, timestamp: number): void {
  if (!isSupabaseConfigured()) return;
  if (!isGroupChatId(peerId) && !isCloudAuthUserId(peerId)) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  void (async () => {
    const threadId = await ensureCloudThreadForChat(peerId);
    if (!threadId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.from('chat_read_state').upsert(
      {
        thread_id: threadId,
        user_id: meId,
        last_read_at: new Date(timestamp).toISOString(),
      },
      { onConflict: 'thread_id,user_id' },
    );
    if (error) console.warn('[cloud-chat] read receipt failed:', error.message);
  })();
}

export function queueCloudMessageReaction(
  peerId: string,
  message: ChatMessage,
  emoji: string | null,
): void {
  if (!isSupabaseConfigured()) return;
  if (!isGroupChatId(peerId) && !isCloudAuthUserId(peerId)) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;
  const cloudId = String(message.cloudId || '').trim();
  if (!cloudId) return;

  void (async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.from('chat_message_reactions').delete().eq('message_id', cloudId).eq('user_id', meId);
    if (!emoji) return;
    const { error } = await supabase.from('chat_message_reactions').upsert(
      { message_id: cloudId, user_id: meId, emoji },
      { onConflict: 'message_id,user_id' },
    );
    if (error) console.warn('[cloud-chat] reaction failed:', error.message);
  })();
}

export function queueCloudMessageUpdate(peerId: string, message: ChatMessage): void {
  if (!message.isAuthor) return;
  if (!isGroupChatId(peerId) && !isCloudAuthUserId(peerId)) return;
  const cloudId = String(message.cloudId || '').trim();
  if (!cloudId || !isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  void supabase
    .from('chat_messages')
    .update({
      body: bodyFromMessage(message),
      payload: messageToPayload(message),
    })
    .eq('id', cloudId)
    .then(({ error }) => {
      if (error) console.warn('[cloud-chat] update failed:', error.message);
    });
}

export function queueCloudCallInvite(
  chatId: string,
  callKind: 'audio' | 'video',
  action: 'invite' | 'end' | 'decline' = 'invite',
): void {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  void (async () => {
    const threadId = await ensureCloudThreadForChat(chatId);
    if (!threadId) return;
    const kind = callKind === 'video' ? 'video' : 'audio';
    const roomName = `ic-chat-call-${kind}-${threadId}`;
    const message: ChatMessage = {
      id: `call_${Date.now()}`,
      text:
        action === 'invite'
          ? kind === 'video'
            ? 'Video call'
            : 'Audio call'
          : `${kind} call ${action}`,
      isAuthor: true,
      from: meId,
      timestamp: Date.now(),
      isCallEvent: true,
      callKind: kind,
      callAction: action,
      callRoomName: roomName,
    };
    db.addMessage(chatId, message);
  })();
}

export async function resolveChatThreadId(chatId: string): Promise<string | null> {
  return ensureCloudThreadForChat(chatId);
}

export function queueCloudMessageDelete(peerId: string, message: ChatMessage): void {
  if (!message.isAuthor) return;
  if (!isGroupChatId(peerId) && !isCloudAuthUserId(peerId)) return;
  const cloudId = String(message.cloudId || '').trim();
  if (!cloudId || !isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  void supabase
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString(), body: 'Message deleted', payload: {} })
    .eq('id', cloudId)
    .then(({ error }) => {
      if (error) console.warn('[cloud-chat] delete failed:', error.message);
    });
}

export async function syncCloudChatInbox(): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId) || !isSupabaseConfigured()) return;

  await hydrateThreadMapFromCloud(meId);
  const peers = Object.keys(loadThreadMap());
  await Promise.all(peers.map((peerId) => syncCloudChatHistory(peerId)));
}

export async function startCloudChatRealtime(userId: string): Promise<void> {
  stopCloudChatRealtime();
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  await hydrateThreadMapFromCloud(userId);

  const onMessageRow = (payload: { new: Record<string, unknown> }) => {
    const row = payload.new as {
      id?: string;
      sender_id?: string;
      body?: string;
      payload?: Record<string, unknown> | null;
      client_id?: string | null;
      deleted_at?: string | null;
      created_at?: string;
      thread_id?: string;
    };
    if (!row?.thread_id) return;
    const peerId = resolvePeerIdForThread(row.thread_id, row.sender_id ?? '');
    if (!peerId) return;
    mergeRemoteMessage(peerId, row);
  };

  realtimeChannel = supabase
    .channel(`chat-messages:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      onMessageRow,
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
      onMessageRow,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_message_reactions' },
      () => {
        void syncCloudChatInbox();
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_read_state' },
      () => {
        void syncCloudChatInbox();
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

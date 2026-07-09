import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '../db/localDb';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { resolveSupabaseSessionUserId } from '../auth/resolveSupabaseSessionUserId';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { fetchProfile, profileRowToUser } from '../supabase/profile';
import { createChatThread, sendChatMessageApi, isPlatformApiAvailable } from '../platformApi';
import type { ChatMessage } from '../dbTypes';
import type { ChatGroup } from '../../types';
import { cloudifyChatMessageMedia } from './chatMediaUpload';
import { normalizeTimestampValue } from '../dbMessageUtils';
import { isChatCloudAvailable, shouldUseFirebaseForChat } from './chatCloud';
import {
  createFirebaseChatThread,
  fetchFirebaseChatMessages,
  fetchFirebaseReadReceipts,
  fetchFirebaseReactionsForThread,
  fetchFirebaseThread,
  findFirebaseDmThread,
  insertFirebaseChatMessage,
  isFirebaseChatAvailable,
  listFirebaseThreadsForUser,
  setFirebaseReaction,
  softDeleteFirebaseChatMessage,
  startFirebaseChatRealtime,
  stopFirebaseChatRealtime,
  updateFirebaseChatMessage,
  updateFirebaseThreadMembers,
  upsertFirebaseReadReceipt,
} from '../firebase/chatMessages';

type ThreadMap = Record<string, string>;

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

let realtimeChannel: RealtimeChannel | null = null;
let firebaseRealtimeStop: (() => void) | null = null;
let inboxListInflight: Promise<void> | null = null;
let inboxSyncInflight: Promise<void> | null = null;
let inboxSyncDebounceTimer: number | null = null;
const threadResolveInflight = new Map<string, Promise<string | null>>();
const reactionSyncTimers = new Map<string, number>();

const SLOW_SEND_MS = 1500;
const STALE_SEND_MS = 5 * 60_000;
/** Do not ring for call invites older than this when replaying history or delayed realtime. */
const STALE_CALL_INVITE_MS = 90_000;

function outboundMessageTimestampMs(message: ChatMessage): number {
  return normalizeTimestampValue(message.timestamp) ?? 0;
}

async function resolveCloudChatAuthUserId(userId: string): Promise<string | null> {
  const trimmed = userId?.trim();
  if (!trimmed || !isCloudAuthUserId(trimmed)) return null;
  if (shouldUseFirebaseForChat(trimmed) && isFirebaseChatAvailable()) return trimmed;
  const authUserId = await resolveSupabaseSessionUserId(trimmed, { attemptMigrate: true });
  return authUserId && isCloudAuthUserId(authUserId) ? authUserId : null;
}

function dispatchChatInboxActivity(chatId: string): void {
  if (typeof window === 'undefined' || !chatId) return;
  window.dispatchEvent(new CustomEvent('chat-inbox-activity', { detail: { chatId } }));
}

function scheduleDebouncedInboxSync(chatIds?: string[]): void {
  if (typeof window === 'undefined') return;
  if (inboxSyncDebounceTimer) window.clearTimeout(inboxSyncDebounceTimer);
  inboxSyncDebounceTimer = window.setTimeout(() => {
    inboxSyncDebounceTimer = null;
    void syncCloudChatInbox(chatIds?.length ? { chatIds } : undefined);
  }, 400);
}

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

async function verifySupabaseDmThread(
  threadId: string,
  meId: string,
  peerId: string,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !threadId) return false;
  const { data, error } = await supabase
    .from('chat_thread_members')
    .select('user_id')
    .eq('thread_id', threadId)
    .in('user_id', [meId, peerId]);
  if (error || !data?.length) return false;
  const members = new Set(data.map((row) => row.user_id).filter(Boolean));
  return members.has(meId) && members.has(peerId);
}

async function findExistingCloudThread(peerId: string, meId: string): Promise<string | null> {
  const tryFirebase = async (): Promise<string | null> => {
    if (!isFirebaseChatAvailable()) return null;
    return findFirebaseDmThread(meId, peerId);
  };

  const trySupabase = async (): Promise<string | null> => {
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
  };

  // Shared DM threads must align across users — Supabase is canonical when configured
  // (LiveKit chat tokens and platform API also use Supabase membership).
  if (isSupabaseConfigured()) {
    return (await trySupabase()) ?? tryFirebase();
  }
  if (shouldUseFirebaseForChat(meId)) {
    return (await tryFirebase()) ?? trySupabase();
  }
  return (await trySupabase()) ?? tryFirebase();
}

async function createCloudThreadDirect(peerId: string, meId: string): Promise<string | null> {
  const trySupabase = async (): Promise<string | null> => {
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
  };

  if (isSupabaseConfigured()) {
    return (await trySupabase()) ?? createFirebaseChatThread([meId, peerId]);
  }
  if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
    return createFirebaseChatThread([meId, peerId]);
  }

  return trySupabase();
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

export function isGroupChatId(chatId: string): boolean {
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
  const tryFirebase = async (): Promise<string | null> => {
    if (!isFirebaseChatAvailable()) return null;
    return insertFirebaseChatMessage(threadId, message, meId);
  };

  const trySupabase = async (): Promise<string | null> => {
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

    if (error) console.warn('[cloud-chat] direct send failed:', error.message);
    return null;
  };

  // Cross-user delivery + LiveKit membership use Supabase when it is configured.
  if (isSupabaseConfigured()) {
    return (await trySupabase()) ?? tryFirebase();
  }
  if (shouldUseFirebaseForChat(meId)) {
    return (await tryFirebase()) ?? trySupabase();
  }
  return (await trySupabase()) ?? tryFirebase();
}

async function hydrateThreadMapFromCloud(userId: string): Promise<void> {
  if (isFirebaseChatAvailable()) {
    const map = loadThreadMap();
    let changed = false;
    const threads = await listFirebaseThreadsForUser(userId);
    for (const thread of threads) {
      if (Object.values(map).includes(thread.id)) continue;
      const meta = (thread.meta ?? {}) as {
        kind?: string;
        localId?: string;
        title?: string;
        avatarUrl?: string;
      };
      const peers = (thread.member_ids ?? []).filter((id) => id && id !== userId);
      if (peers.length === 1 && meta.kind !== 'group') {
        map[peers[0]] = thread.id;
        changed = true;
        continue;
      }
      if (peers.length >= 1 && (meta.kind === 'group' || peers.length >= 2)) {
        const localId = meta.localId || `group_cloud_${thread.id.slice(0, 8)}`;
        map[localId] = thread.id;
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

/** Resolve local chat id from cloud thread — used when thread map is cold on a new device. */
async function resolvePeerIdFromCloudThread(
  threadId: string,
  senderId: string,
): Promise<string | null> {
  const cached = resolvePeerIdForThread(threadId, senderId);
  if (cached) return cached;

  const inflight = threadResolveInflight.get(threadId);
  if (inflight) return inflight;

  const task = (async () => {
    const meId = db.currentUserId;
    if (!meId) return null;

    const resolveFromSupabase = async (): Promise<string | null> => {
      const supabase = getSupabaseClient();
      if (!supabase) return null;

      const [{ data: threadRow }, { data: members, error: membersErr }] = await Promise.all([
        supabase.from('chat_threads').select('id, meta').eq('id', threadId).maybeSingle(),
        supabase.from('chat_thread_members').select('user_id').eq('thread_id', threadId),
      ]);
      if (membersErr || !members?.length) return null;

      const meta = (threadRow?.meta ?? {}) as {
        kind?: string;
        localId?: string;
        title?: string;
        avatarUrl?: string;
      };
      const peers = members.map((row) => row.user_id).filter((id) => id && id !== meId);

      if (peers.length === 1 && meta.kind !== 'group') {
        rememberThreadPeer(peers[0], threadId);
        return peers[0];
      }

      if (peers.length >= 1 && (meta.kind === 'group' || peers.length >= 2)) {
        const localId = meta.localId || `group_cloud_${threadId.slice(0, 8)}`;
        rememberThreadPeer(localId, threadId);
        db.mergeInboundChatGroup({
          id: localId,
          displayName: meta.title || 'Group chat',
          username: `${peers.length + 1} members`,
          avatarUrl:
            meta.avatarUrl ||
            'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100',
          isGroup: true,
          memberIds: [meId, ...peers],
          createdBy: meId,
          adminIds: [meId],
          mutedMemberIds: [],
          adminOnlyPosting: false,
          requireApprovalToJoin: false,
        });
        return localId;
      }

      if (senderId && senderId !== meId && isCloudAuthUserId(senderId)) {
        rememberThreadPeer(senderId, threadId);
        return senderId;
      }

      return null;
    };

    const resolveFromFirebase = async (): Promise<string | null> => {
      if (!isFirebaseChatAvailable()) return null;
      const thread = await fetchFirebaseThread(threadId);
      if (!thread) return null;
      const meta = (thread.meta ?? {}) as { kind?: string; localId?: string };
      const peers = (thread.member_ids ?? []).filter((id) => id && id !== meId);
      if (peers.length === 1 && meta.kind !== 'group') {
        rememberThreadPeer(peers[0], threadId);
        return peers[0];
      }
      if (peers.length >= 1 && (meta.kind === 'group' || peers.length >= 2)) {
        const localId = meta.localId || `group_cloud_${threadId.slice(0, 8)}`;
        rememberThreadPeer(localId, threadId);
        return localId;
      }
      if (senderId && senderId !== meId && isCloudAuthUserId(senderId)) {
        rememberThreadPeer(senderId, threadId);
        return senderId;
      }
      return null;
    };

    if (isSupabaseConfigured()) {
      return (await resolveFromSupabase()) ?? resolveFromFirebase();
    }
    if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
      return (await resolveFromFirebase()) ?? resolveFromSupabase();
    }
    return resolveFromSupabase();
  })().finally(() => {
    threadResolveInflight.delete(threadId);
  });

  threadResolveInflight.set(threadId, task);
  return task;
}

function scheduleReactionSyncForCloudMessage(cloudMessageId: string): void {
  if (!cloudMessageId || typeof window === 'undefined') return;
  const existing = reactionSyncTimers.get(cloudMessageId);
  if (existing) window.clearTimeout(existing);
  reactionSyncTimers.set(
    cloudMessageId,
    window.setTimeout(() => {
      reactionSyncTimers.delete(cloudMessageId);
      void syncReactionsForCloudMessage(cloudMessageId);
    }, 200),
  );
}

async function syncReactionsForCloudMessage(cloudMessageId: string): Promise<void> {
  const meId = db.currentUserId;
  if (!meId) return;

  if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
    const threadIds = [...new Set(Object.values(loadThreadMap()))];
    for (const threadId of threadIds) {
      const messages = await fetchFirebaseChatMessages(threadId, 200);
      if (!messages.some((row) => row.id === cloudMessageId)) continue;
      const peerId = resolvePeerIdForThread(threadId, '');
      if (peerId) await syncCloudReactionsForThread(threadId, peerId);
      return;
    }
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: msgRow } = await supabase
    .from('chat_messages')
    .select('thread_id')
    .eq('id', cloudMessageId)
    .maybeSingle();
  if (!msgRow?.thread_id) return;
  const peerId = await resolvePeerIdFromCloudThread(msgRow.thread_id, '');
  if (!peerId) return;
  await syncCloudReactionsForThread(msgRow.thread_id, peerId);
}

export async function ensureCloudThreadForGroup(group: ChatGroup): Promise<string | null> {
  if (!isChatCloudAvailable()) return null;
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

  if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
    const threadId = await createFirebaseChatThread(memberIds, {
      kind: 'group',
      localId: group.id,
      title: group.displayName,
      avatarUrl: group.avatarUrl,
    });
    if (threadId) rememberThreadPeer(group.id, threadId);
    return threadId;
  }

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

export async function syncCloudGroupMembers(group: ChatGroup): Promise<void> {
  if (!isChatCloudAvailable() || !group?.id) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const threadId = await ensureCloudThreadForGroup(group);
  if (!threadId) return;

  const memberIds = [
    ...new Set(
      (group.memberIds || [])
        .map((id) => String(id || '').trim())
        .filter((id) => isCloudAuthUserId(id)),
    ),
  ];
  if (!memberIds.includes(meId)) memberIds.push(meId);

  if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
    await updateFirebaseThreadMembers(threadId, memberIds, {
      kind: 'group',
      localId: group.id,
      title: group.displayName,
      avatarUrl: group.avatarUrl,
    });
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: existing } = await supabase
    .from('chat_thread_members')
    .select('user_id')
    .eq('thread_id', threadId);
  const existingIds = new Set((existing || []).map((row) => row.user_id).filter(Boolean));
  const toAdd = memberIds.filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !memberIds.includes(id));

  if (toAdd.length) {
    const { error } = await supabase.from('chat_thread_members').insert(
      toAdd.map((user_id) => ({ thread_id: threadId, user_id })),
    );
    if (error) console.warn('[cloud-chat] group member add failed:', error.message);
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from('chat_thread_members')
      .delete()
      .eq('thread_id', threadId)
      .in('user_id', toRemove);
    if (error) console.warn('[cloud-chat] group member remove failed:', error.message);
  }

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
    .eq('id', threadId);
}

export async function ensureCloudThreadForChat(chatId: string): Promise<string | null> {
  const inflight = threadResolveInflight.get(chatId);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      if (isGroupChatId(chatId)) {
        const group = db.getChatGroup(chatId);
        if (!group) return null;
        return ensureCloudThreadForGroup(group);
      }
      return ensureCloudThreadForPeer(chatId);
    } finally {
      threadResolveInflight.delete(chatId);
    }
  })();

  threadResolveInflight.set(chatId, task);
  return task;
}

export async function ensureCloudThreadForPeer(peerId: string): Promise<string | null> {
  if (!isChatCloudAvailable() || !isCloudAuthUserId(peerId)) return null;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return null;

  const map = loadThreadMap();
  if (map[peerId]) {
    if (isSupabaseConfigured()) {
      const valid = await verifySupabaseDmThread(map[peerId], meId, peerId);
      if (valid) return map[peerId];
    } else {
      return map[peerId];
    }
  }

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

function resolveOutboundDelivery(
  chatId: string,
  message: ChatMessage,
  status: 'sent' | 'failed',
): void {
  const localId = message.id ? String(message.id) : '';
  if (!chatId || !localId) return;
  db.markMessageDeliveryStatus(chatId, localId, status);
}

/** Fix messages stuck in `sending` from prior sync failures or silent queue exits. */
export function healOutboundDeliveryForChat(chatId: string): void {
  if (!chatId) return;
  const thread = db.messages[chatId];
  if (!Array.isArray(thread) || thread.length === 0) return;

  const now = Date.now();
  for (const message of thread) {
    if (!message.isAuthor || message.deliveryStatus !== 'sending' || !message.id) continue;

    if (message.cloudId) {
      db.markMessageDeliveryStatus(chatId, String(message.id), 'sent');
      continue;
    }

    const ts = outboundMessageTimestampMs(message);
    if (ts <= 0) continue;

    const age = now - ts;
    if (age > STALE_SEND_MS) {
      db.markMessageDeliveryStatus(chatId, String(message.id), 'sent');
      continue;
    }

    if (age >= SLOW_SEND_MS) {
      queueCloudMessageSend(chatId, message);
    }
  }
}

export function queueCloudMessageSend(chatId: string, message: ChatMessage): void {
  if (!message.isAuthor) return;

  const cloudEnabled = isChatCloudAvailable();
  if (!cloudEnabled) {
    resolveOutboundDelivery(chatId, message, 'sent');
    return;
  }

  const hasContent =
    String(message.text ?? '').trim() ||
    (Array.isArray(message.media) && message.media.length > 0) ||
    !!message.location ||
    !!message.isCallEvent;
  if (!hasContent) {
    resolveOutboundDelivery(chatId, message, 'sent');
    return;
  }

  void (async () => {
    const meId = db.currentUserId;
    if (!meId || !isCloudAuthUserId(meId)) {
      resolveOutboundDelivery(chatId, message, 'sent');
      return;
    }
    if (!isGroupChatId(chatId) && !isCloudAuthUserId(chatId)) {
      resolveOutboundDelivery(chatId, message, 'sent');
      return;
    }

    const threadId = await ensureCloudThreadForChat(chatId);
    if (!threadId) {
      resolveOutboundDelivery(chatId, message, 'failed');
      return;
    }

    const withMedia = await cloudifyChatMessageMedia(meId, {
      ...message,
      from: message.from || meId,
    });
    const cloudId = await sendChatMessageDirect(threadId, withMedia, meId);
    if (cloudId && withMedia.id) {
      db.attachCloudMessageId(chatId, String(withMedia.id), cloudId);
      db.mergeInboundMessage(chatId, { ...withMedia, cloudId, isAuthor: true }, { bumpUnread: false });
      resolveOutboundDelivery(chatId, message, 'sent');
      return;
    }

    try {
      const apiRow = await sendChatMessageApi(
        threadId,
        bodyFromMessage(withMedia),
        messageToPayload(withMedia),
        withMedia.id ? String(withMedia.id) : undefined,
      );
      const apiCloudId = apiRow?.id ? String(apiRow.id) : null;
      if (apiCloudId && withMedia.id) {
        db.attachCloudMessageId(chatId, String(withMedia.id), apiCloudId);
        db.mergeInboundMessage(chatId, { ...withMedia, cloudId: apiCloudId, isAuthor: true }, { bumpUnread: false });
      }
      resolveOutboundDelivery(chatId, message, 'sent');
    } catch (apiErr) {
      console.warn('[cloud-chat] API send failed:', apiErr);
      resolveOutboundDelivery(chatId, message, 'failed');
    }
  })();
}

export function retryCloudMessageSend(chatId: string, message: ChatMessage): void {
  if (!chatId || !message?.id || !message.isAuthor) return;
  db.markMessageDeliveryStatus(chatId, String(message.id), 'sending');
  queueCloudMessageSend(chatId, { ...message, deliveryStatus: 'sending' });
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
  options?: { source?: 'realtime' | 'history' },
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
  if (!isAuthor) dispatchChatInboxActivity(chatId);

  const fromRealtime = options?.source === 'realtime';
  const msgTs =
    typeof msg.timestamp === 'number'
      ? msg.timestamp
      : typeof msg.timestamp === 'string'
        ? Date.parse(msg.timestamp)
        : 0;
  const inviteFresh =
    msgTs > 0 && Number.isFinite(msgTs)
      ? Date.now() - msgTs <= STALE_CALL_INVITE_MS
      : true;

  if (inviteFresh && msg.isCallEvent && msg.callAction === 'invite' && msg.callRoomName) {
    window.dispatchEvent(
      new CustomEvent('chat-call-invite', {
        detail: {
          chatId,
          fromUserId: senderId,
          callKind: msg.callKind === 'video' ? 'video' : 'audio',
          callRoomName: msg.callRoomName,
          threadId: loadThreadMap()[chatId],
          isGroup: isGroupChatId(chatId),
        },
      }),
    );
  }

  if (
    (fromRealtime || inviteFresh) &&
    msg.isCallEvent &&
    (msg.callAction === 'end' || msg.callAction === 'decline')
  ) {
    window.dispatchEvent(
      new CustomEvent('chat-call-signal', {
        detail: {
          chatId,
          fromUserId: senderId,
          action: msg.callAction,
          callKind: msg.callKind === 'video' ? 'video' : 'audio',
        },
      }),
    );
  }
}

export async function syncCloudChatHistory(chatId: string): Promise<void> {
  if (!isChatCloudAvailable()) return;
  if (!isGroupChatId(chatId) && !isCloudAuthUserId(chatId)) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const threadId = await ensureCloudThreadForChat(chatId);
  if (!threadId) return;

  const pullRows = async (
    fetcher: () => Promise<
      Array<{
        id?: string;
        sender_id?: string;
        body?: string;
        payload?: Record<string, unknown> | null;
        client_id?: string | null;
        deleted_at?: string | null;
        created_at?: string;
      }>
    >,
  ) => {
    const rows = await fetcher().catch(() => []);
    if (!rows.length) return;
    if (!isGroupChatId(chatId)) await ensurePeerProfileCached(chatId);
    for (const row of rows) {
      if (!row.sender_id) continue;
      if (isCloudAuthUserId(row.sender_id)) void ensurePeerProfileCached(row.sender_id);
      mergeRemoteMessage(chatId, row, { source: 'history' });
    }
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, sender_id, body, payload, client_id, deleted_at, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (!error && data?.length) {
        await pullRows(async () => data);
      }
    }
  }
  if (isFirebaseChatAvailable()) {
    await pullRows(() => fetchFirebaseChatMessages(threadId, 200));
  }

  await syncCloudReactionsForThread(threadId, chatId);
  await syncCloudReadReceipt(chatId, threadId, meId);
}

async function syncCloudReactionsForThread(threadId: string, peerId: string): Promise<void> {
  const meId = db.currentUserId;
  if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
    const messages = await fetchFirebaseChatMessages(threadId, 200);
    if (!messages.length) return;
    const messageIds = messages.map((m) => m.id).filter(Boolean) as string[];
    if (!messageIds.length) return;
    const reactions = await fetchFirebaseReactionsForThread(threadId, messageIds);
    if (!reactions.length) return;

    const byMessage = new Map<string, { counts: Record<string, number>; selected: string | null }>();
    for (const row of reactions) {
      const entry = byMessage.get(row.message_id) ?? { counts: {}, selected: null };
      entry.counts[row.emoji] = (entry.counts[row.emoji] || 0) + 1;
      if (row.user_id === meId) entry.selected = row.emoji;
      byMessage.set(row.message_id, entry);
    }

    for (const msg of messages) {
      if (!msg.id) continue;
      const state = byMessage.get(msg.id);
      if (!state) continue;
      const localId = String(msg.client_id || (msg.payload as { id?: string } | null)?.id || msg.id);
      db.applyInboundMessageReaction(peerId, localId, state);
    }
    return;
  }

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
  let data: Array<{ user_id: string; last_read_at: string }> = [];

  if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
    data = await fetchFirebaseReadReceipts(threadId);
  } else {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data: rows } = await supabase
      .from('chat_read_state')
      .select('user_id, last_read_at')
      .eq('thread_id', threadId);
    data = (rows ?? []) as Array<{ user_id: string; last_read_at: string }>;
  }
  if (!data.length) return;

  if (isGroupChatId(peerId)) {
    let maxOtherRead = 0;
    for (const row of data) {
      const ts = Date.parse(row.last_read_at) || 0;
      if (!ts) continue;
      if (row.user_id === meId) {
        db.setChatReadAt(peerId, ts, { skipCloud: true });
      } else if (ts > maxOtherRead) {
        maxOtherRead = ts;
      }
    }
    if (maxOtherRead > 0) {
      db.setChatPeerReadAt(peerId, maxOtherRead);
    }
    return;
  }

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
  if (!isChatCloudAvailable()) return;
  if (!isGroupChatId(peerId) && !isCloudAuthUserId(peerId)) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  void (async () => {
    const threadId = await ensureCloudThreadForChat(peerId);
    if (!threadId) return;
    if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
      await upsertFirebaseReadReceipt(threadId, meId, timestamp);
      return;
    }
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
  if (!isChatCloudAvailable()) return;
  if (!isGroupChatId(peerId) && !isCloudAuthUserId(peerId)) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;
  const cloudId = String(message.cloudId || '').trim();
  if (!cloudId) return;

  void (async () => {
    const threadId = await ensureCloudThreadForChat(peerId);
    if (!threadId) return;
    if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
      await setFirebaseReaction(threadId, cloudId, meId, emoji);
      return;
    }
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
  if (!cloudId || !isChatCloudAvailable()) return;
  const meId = db.currentUserId;
  if (!meId) return;

  void (async () => {
    const threadId = await ensureCloudThreadForChat(peerId);
    if (!threadId) return;
    if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
      await updateFirebaseChatMessage(
        threadId,
        cloudId,
        bodyFromMessage(message),
        messageToPayload(message),
      );
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase
      .from('chat_messages')
      .update({
        body: bodyFromMessage(message),
        payload: messageToPayload(message),
      })
      .eq('id', cloudId);
    if (error) console.warn('[cloud-chat] update failed:', error.message);
  })();
}

export function queueCloudCallInvite(
  chatId: string,
  callKind: 'audio' | 'video',
  action: 'invite' | 'end' | 'decline' = 'invite',
): void {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId) || !isChatCloudAvailable()) return;

  void (async () => {
    const threadId = await ensureCloudThreadForChat(chatId);
    if (!threadId) return;
    const kind = callKind === 'video' ? 'video' : 'audio';
    const roomName = `ic-chat-call-${kind}-${threadId}`;
    const message: ChatMessage = {
      id: `call_${Date.now()}_${action}`,
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
      deliveryStatus: 'sending',
    };
    db.mergeInboundMessage(chatId, message, { bumpUnread: false });
    queueCloudMessageSend(chatId, message);
  })();
}

export async function resolveChatThreadId(chatId: string): Promise<string | null> {
  return ensureCloudThreadForChat(chatId);
}

export function queueCloudMessageDelete(peerId: string, message: ChatMessage): void {
  if (!message.isAuthor) return;
  if (!isGroupChatId(peerId) && !isCloudAuthUserId(peerId)) return;
  const cloudId = String(message.cloudId || '').trim();
  if (!cloudId || !isChatCloudAvailable()) return;
  const meId = db.currentUserId;
  if (!meId) return;

  void (async () => {
    const threadId = await ensureCloudThreadForChat(peerId);
    if (!threadId) return;
    if (shouldUseFirebaseForChat(meId) && isFirebaseChatAvailable()) {
      await softDeleteFirebaseChatMessage(threadId, cloudId);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString(), body: 'Message deleted', payload: {} })
      .eq('id', cloudId);
    if (error) console.warn('[cloud-chat] delete failed:', error.message);
  })();
}

export async function refreshCloudChatInboxList(): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || !isChatCloudAvailable()) return;
  const authUserId = await resolveCloudChatAuthUserId(meId);
  if (!authUserId) return;
  if (inboxListInflight) return inboxListInflight;
  inboxListInflight = hydrateThreadMapFromCloud(authUserId).finally(() => {
    inboxListInflight = null;
  });
  return inboxListInflight;
}

export async function syncCloudChatInbox(options?: { chatIds?: string[] }): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || !isChatCloudAvailable()) return;

  const authUserId = await resolveCloudChatAuthUserId(meId);
  if (!authUserId) return;

  if (inboxSyncInflight) return inboxSyncInflight;

  inboxSyncInflight = (async () => {
    try {
      await hydrateThreadMapFromCloud(authUserId);
      const peers = options?.chatIds?.length
        ? options.chatIds
        : Object.keys(loadThreadMap());
      await Promise.all(peers.map((chatId) => syncCloudChatHistory(chatId)));
    } finally {
      inboxSyncInflight = null;
    }
  })();

  return inboxSyncInflight;
}

export async function startCloudChatRealtime(userId: string): Promise<void> {
  stopCloudChatRealtime();
  const authUserId = await resolveCloudChatAuthUserId(userId);
  if (!authUserId || !isChatCloudAvailable()) return;

  await hydrateThreadMapFromCloud(authUserId);

  const onMessageRow = (row: {
    id?: string;
    sender_id?: string;
    body?: string;
    payload?: Record<string, unknown> | null;
    client_id?: string | null;
    deleted_at?: string | null;
    created_at?: string;
    thread_id?: string;
  }) => {
    if (!row?.thread_id) return;
    const peerId = resolvePeerIdForThread(row.thread_id, row.sender_id ?? '');
    if (peerId) {
      mergeRemoteMessage(peerId, row, { source: 'realtime' });
      return;
    }
    void resolvePeerIdFromCloudThread(row.thread_id, row.sender_id ?? '').then((resolved) => {
      if (resolved) mergeRemoteMessage(resolved, row, { source: 'realtime' });
    });
  };

  if (isFirebaseChatAvailable()) {
    firebaseRealtimeStop = startFirebaseChatRealtime(authUserId, {
      onMessage: (row) => onMessageRow(row),
      onReaction: (messageId) => scheduleReactionSyncForCloudMessage(messageId),
      onReadState: (threadId) => {
        const chatId = resolvePeerIdForThread(threadId, '');
        const meId = db.currentUserId;
        if (chatId && meId) void syncCloudReadReceipt(chatId, threadId, meId);
      },
      onMembership: () => {
        void hydrateThreadMapFromCloud(authUserId);
      },
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  realtimeChannel = supabase
    .channel(`chat-messages:${authUserId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => onMessageRow(payload.new as Parameters<typeof onMessageRow>[0]),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
      (payload) => onMessageRow(payload.new as Parameters<typeof onMessageRow>[0]),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_message_reactions' },
      (payload) => {
        const row = (payload.new || payload.old) as { message_id?: string } | null;
        if (row?.message_id) {
          scheduleReactionSyncForCloudMessage(row.message_id);
          return;
        }
        scheduleDebouncedInboxSync();
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_thread_members' },
      () => {
        void hydrateThreadMapFromCloud(authUserId);
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_read_state' },
      (payload) => {
        const row = (payload.new || payload.old) as {
          thread_id?: string;
          user_id?: string;
          last_read_at?: string;
        } | null;
        if (!row?.thread_id) {
          scheduleDebouncedInboxSync();
          return;
        }
        const chatId = resolvePeerIdForThread(row.thread_id, row.user_id ?? '');
        const meId = db.currentUserId;
        if (chatId && meId) {
          void syncCloudReadReceipt(chatId, row.thread_id, meId);
        } else {
          scheduleDebouncedInboxSync();
        }
      },
    )
    .subscribe();
}

export function stopCloudChatRealtime(): void {
  firebaseRealtimeStop?.();
  firebaseRealtimeStop = null;
  stopFirebaseChatRealtime();
  const supabase = getSupabaseClient();
  if (realtimeChannel && supabase) {
    void supabase.removeChannel(realtimeChannel);
  }
  realtimeChannel = null;
}

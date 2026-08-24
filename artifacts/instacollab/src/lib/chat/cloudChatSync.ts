import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '../db/localDb';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { resolveSupabaseSessionUserId } from '../auth/resolveSupabaseSessionUserId';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import {
  removeSafeRealtimeChannel,
  subscribeSafeRealtimeChannel,
} from '../supabase/safeRealtimeChannel';
import { isFirebaseConfigured } from '../firebase/config';
import { fetchProfile, profileRowToUser } from '../supabase/profile';
import { createChatThread, sendChatMessageApi, deleteChatMessageApi, isPlatformApiAvailable, fetchChatThreads, fetchChatThreadMessages } from '../platformApi';
import { enqueueChatMessageSend, processChatOutbox } from '../outbox/chatOutboxProcessor';
import { getOutboxItemByMutation, removeOutboxItemsByMutation } from '../outbox/outboxStore';
import type { ChatMessage } from '../dbTypes';
import type { ChatGroup } from '../../types';
import { cloudifyChatMessageMedia } from './chatMediaUpload';
import { normalizeTimestampValue } from '../dbMessageUtils';
import { isChatCloudAvailable, shouldUseFirebaseForChat } from './chatCloud';

async function firebaseChat() {
  return import('../firebase/chatMessages');
}

type ThreadMap = Record<string, string>;


type GroupThreadMeta = {
  kind?: string;
  localId?: string;
  title?: string;
  avatarUrl?: string;
  createdBy?: string;
  adminIds?: string[];
  mutedMemberIds?: string[];
  adminOnlyPosting?: boolean;
  requireApprovalToJoin?: boolean;
};

export function buildCanonicalDmKey(a: string, b: string): string {
  return [String(a || '').trim(), String(b || '').trim()].sort().join(':');
}

function groupThreadMeta(group: ChatGroup): GroupThreadMeta {
  const memberIds = new Set((group.memberIds || []).map(String).filter(Boolean));
  const createdBy = memberIds.has(String(group.createdBy || '')) ? String(group.createdBy) : undefined;
  const adminIds = [...new Set((group.adminIds || []).map(String).filter((id) => memberIds.has(id)))];
  if (createdBy && !adminIds.includes(createdBy)) adminIds.unshift(createdBy);
  return {
    kind: 'group',
    localId: group.id,
    title: group.displayName,
    avatarUrl: group.avatarUrl,
    createdBy,
    adminIds,
    mutedMemberIds: [...new Set((group.mutedMemberIds || []).map(String).filter((id) => memberIds.has(id)))],
    adminOnlyPosting: !!group.adminOnlyPosting,
    requireApprovalToJoin: !!group.requireApprovalToJoin,
  };
}

function groupFromThreadMeta(
  localId: string,
  meta: GroupThreadMeta,
  memberIds: string[],
): ChatGroup {
  const members = [...new Set(memberIds.filter(Boolean))];
  const createdBy =
    typeof meta.createdBy === 'string' && members.includes(meta.createdBy)
      ? meta.createdBy
      : '';
  const adminIds = Array.isArray(meta.adminIds)
    ? [...new Set(meta.adminIds.filter((id) => members.includes(id)))]
    : [];
  if (createdBy && !adminIds.includes(createdBy)) adminIds.unshift(createdBy);
  return {
    id: localId,
    displayName: typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : 'Group chat',
    username: `${members.length} members`,
    avatarUrl:
      typeof meta.avatarUrl === 'string' && meta.avatarUrl.trim()
        ? meta.avatarUrl
        : 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100',
    isGroup: true,
    memberIds: members,
    createdBy,
    adminIds,
    mutedMemberIds: Array.isArray(meta.mutedMemberIds)
      ? [...new Set(meta.mutedMemberIds.filter((id) => members.includes(id)))]
      : [],
    adminOnlyPosting: !!meta.adminOnlyPosting,
    requireApprovalToJoin: !!meta.requireApprovalToJoin,
  };
}

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

let realtimeChannel: RealtimeChannel | null = null;
let firebaseRealtimeStop: (() => void) | null = null;
let chatRealtimeActiveAuthUserId: string | null = null;
let chatRealtimeStartSeq = 0;
let chatRealtimeStartInflight: Promise<void> | null = null;
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
  if (shouldUseFirebaseForChat(trimmed) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) return trimmed;
  }
  const authUserId = await resolveSupabaseSessionUserId(trimmed, { attemptMigrate: true });
  return authUserId && isCloudAuthUserId(authUserId) ? authUserId : null;
}

function dispatchChatInboxActivity(chatId: string): void {
  if (typeof window === 'undefined' || !chatId) return;
  window.dispatchEvent(new CustomEvent('chat-inbox-activity', { detail: { chatId } }));
}

function scheduleDebouncedInboxSync(chatIds?: string[]): void {
  if (typeof window === 'undefined') return;
  // Microtask coalesce only — no 400ms lag on inbound chat events.
  if (inboxSyncDebounceTimer) window.clearTimeout(inboxSyncDebounceTimer);
  inboxSyncDebounceTimer = window.setTimeout(() => {
    inboxSyncDebounceTimer = null;
    void syncCloudChatInbox(chatIds?.length ? { chatIds } : undefined);
  }, 0);
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
  if (!peerId || !threadId) return;
  const map = loadThreadMap();
  let changed = false;
  // One canonical local chat id owns one cloud thread. Remove stale aliases left by
  // older sender-based realtime mapping so group traffic cannot leak into a DM.
  for (const [localId, mappedThreadId] of Object.entries(map)) {
    if (mappedThreadId === threadId && localId !== peerId) {
      delete map[localId];
      changed = true;
    }
  }
  if (map[peerId] !== threadId) {
    map[peerId] = threadId;
    changed = true;
  }
  if (changed) saveThreadMap(map);
}

function dropLocalThreadMappingByThreadId(threadId: string): void {
  if (!threadId) return;
  const map = loadThreadMap();
  const removedLocalIds = Object.entries(map)
    .filter(([, mappedThreadId]) => mappedThreadId === threadId)
    .map(([localId]) => localId);
  if (!removedLocalIds.length) return;
  for (const localId of removedLocalIds) delete map[localId];
  saveThreadMap(map);
  const groupsToRemove = new Set(removedLocalIds.filter((id) => Boolean(db.getChatGroup(id))));
  if (groupsToRemove.size) {
    db.saveChatGroups(db.chatGroups.filter((group) => !groupsToRemove.has(group.id)));
  }
  for (const localId of removedLocalIds) dispatchChatInboxActivity(localId);
}

function pruneThreadMapToAuthoritativeMembership(activeThreadIds: Iterable<string>): void {
  const active = new Set([...activeThreadIds].map(String).filter(Boolean));
  const map = loadThreadMap();
  const staleThreadIds = [...new Set(Object.values(map).filter((threadId) => !active.has(threadId)))];
  for (const threadId of staleThreadIds) dropLocalThreadMappingByThreadId(threadId);
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
  const expectedKey = buildCanonicalDmKey(meId, peerId);
  const [{ data: thread, error: threadErr }, { data: membershipRows, error: memberErr }] = await Promise.all([
    supabase
      .from('chat_threads')
      .select('id, thread_type, dm_key, meta')
      .eq('id', threadId)
      .maybeSingle(),
    supabase.from('chat_thread_members').select('user_id').eq('thread_id', threadId),
  ]);
  if (threadErr || memberErr || !thread) return false;
  const meta = (thread.meta ?? {}) as GroupThreadMeta;
  if (thread.thread_type === 'group' || meta.kind === 'group') return false;
  if (thread.dm_key && thread.dm_key !== expectedKey) return false;
  const members = new Set((membershipRows ?? []).map((row) => String(row.user_id || '')).filter(Boolean));
  return members.size === 2 && members.has(meId) && members.has(peerId);
}

async function findAndRepairLegacySupabaseDmThread(peerId: string, meId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: mine, error: mineErr } = await supabase
    .from('chat_thread_members')
    .select('thread_id')
    .eq('user_id', meId);
  if (mineErr || !mine?.length) return null;
  const dmKey = buildCanonicalDmKey(meId, peerId);
  for (const membership of mine) {
    const threadId = String(membership.thread_id || '');
    if (!threadId) continue;
    const [{ data: thread }, { data: rows }] = await Promise.all([
      supabase.from('chat_threads').select('id, thread_type, dm_key, meta').eq('id', threadId).maybeSingle(),
      supabase.from('chat_thread_members').select('user_id').eq('thread_id', threadId),
    ]);
    if (!thread) continue;
    const meta = (thread.meta ?? {}) as GroupThreadMeta;
    if (thread.thread_type === 'group' || meta.kind === 'group') continue;
    const members = [...new Set((rows ?? []).map((row) => String(row.user_id || '')).filter(Boolean))];
    if (members.length !== 2 || !members.includes(meId) || !members.includes(peerId)) continue;
    const { error: repairErr } = await supabase
      .from('chat_threads')
      .update({ thread_type: 'dm', dm_key: dmKey })
      .eq('id', threadId);
    if (!repairErr) return threadId;
    if (repairErr.code === '23505') {
      const { data: canonical } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('thread_type', 'dm')
        .eq('dm_key', dmKey)
        .maybeSingle();
      if (canonical?.id && await verifySupabaseDmThread(canonical.id, meId, peerId)) return canonical.id;
    }
  }
  return null;
}

async function findExistingCloudThread(peerId: string, meId: string): Promise<string | null> {
  const tryFirebase = async (): Promise<string | null> => {
    if (!isFirebaseConfigured()) return null;
    const fb = await firebaseChat();
    if (!fb.isFirebaseChatAvailable()) return null;
    return fb.findFirebaseDmThread(meId, peerId);
  };

  const trySupabase = async (): Promise<string | null> => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    // Never resolve a DM by "first shared thread". Two users may also share one or
    // more group threads; the canonical dm_key is the only unambiguous mapping.
    const dmKey = buildCanonicalDmKey(meId, peerId);
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('thread_type', 'dm')
      .eq('dm_key', dmKey)
      .maybeSingle();
    if (!error && thread?.id && await verifySupabaseDmThread(thread.id, meId, peerId)) return thread.id;
    // Upgrade old exact-two-member threads that predate thread_type/dm_key.
    return findAndRepairLegacySupabaseDmThread(peerId, meId);
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
    const dmKey = buildCanonicalDmKey(meId, peerId);

    const { data: thread, error: threadErr } = await supabase
      .from('chat_threads')
      .insert({ thread_type: 'dm', dm_key: dmKey })
      .select('id')
      .single();
    if (threadErr || !thread?.id) {
      // Concurrent creators converge on the unique dm_key instead of minting
      // duplicate 1:1 threads.
      if (threadErr?.code === '23505') {
        const existing = await findExistingCloudThread(peerId, meId);
        if (existing) return existing;
      }
      console.warn('[cloud-chat] direct thread create failed:', threadErr?.message);
      return null;
    }

    // Legacy RLS allows a user to add another member only after the current
    // user is already a member. Insert self first, then peer.
    const { error: selfErr } = await supabase.from('chat_thread_members').insert({
      thread_id: thread.id,
      user_id: meId,
    });
    if (selfErr && selfErr.code !== '23505') {
      console.warn('[cloud-chat] direct self membership failed:', selfErr.message);
      return findExistingCloudThread(peerId, meId);
    }
    const { error: peerErr } = await supabase.from('chat_thread_members').insert({
      thread_id: thread.id,
      user_id: peerId,
    });
    if (peerErr && peerErr.code !== '23505') {
      console.warn('[cloud-chat] direct peer membership failed:', peerErr.message);
      return findExistingCloudThread(peerId, meId);
    }

    return thread.id;
  };

  const tryFirebase = async (): Promise<string | null> => {
    if (!isFirebaseConfigured()) return null;
    const fb = await firebaseChat();
    if (!fb.isFirebaseChatAvailable()) return null;
    return fb.createFirebaseChatThread([meId, peerId]);
  };

  if (isSupabaseConfigured()) {
    return (await trySupabase()) ?? tryFirebase();
  }
  if (shouldUseFirebaseForChat(meId)) {
    return (await tryFirebase()) ?? trySupabase();
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
  const id = String(chatId || '').trim();
  if (!id) return false;
  // Group ids are not guaranteed to use a `group_` prefix. The persisted group
  // domain object is authoritative; the prefix remains only as a cold-cache fallback.
  return Boolean(db.getChatGroup(id)) || id.startsWith('group') || id.startsWith('group_');
}

function bodyFromMessage(message: ChatMessage): string {
  if (message.isCallEvent) {
    const kind = message.callKind === 'video' ? 'Video' : 'Audio';
    if (message.callAction === 'end') return `${kind} call ended`;
    if (message.callAction === 'decline') return `${kind} call declined`;
    if (message.callAction === 'accept') return `${kind} call accepted`;
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
    if (!isFirebaseConfigured()) return null;
    const fb = await firebaseChat();
    if (!fb.isFirebaseChatAvailable()) return null;
    return fb.insertFirebaseChatMessage(threadId, message, meId);
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
        .eq('sender_id', meId)
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
  const activeThreadIds = new Set<string>();
  const applyDescriptor = (
    threadId: string,
    memberIds: string[],
    rawMeta: GroupThreadMeta | null | undefined,
    threadType?: string,
  ) => {
    if (!threadId) return;
    const members = [...new Set(memberIds.map(String).filter(Boolean))];
    if (!members.includes(userId)) return;
    activeThreadIds.add(threadId);
    const peers = members.filter((id) => id !== userId);
    const meta = (rawMeta ?? {}) as GroupThreadMeta;
    const isGroup = threadType === 'group' || meta.kind === 'group' || peers.length >= 2;

    if (!isGroup && peers.length === 1) {
      rememberThreadPeer(peers[0], threadId);
      void ensurePeerProfileCached(peers[0]);
      return;
    }
    if (isGroup) {
      const localId =
        typeof meta.localId === 'string' && meta.localId.trim()
          ? meta.localId.trim()
          : `group_cloud_${threadId.slice(0, 8)}`;
      rememberThreadPeer(localId, threadId);
      db.mergeInboundChatGroup(groupFromThreadMeta(localId, meta, members));
    }
  };

  // Server API is the canonical membership list when available. An empty successful
  // response is authoritative and must prune stale local mappings/groups.
  if (isPlatformApiAvailable()) {
    try {
      const { threads } = await fetchChatThreads();
      if (Array.isArray(threads)) {
        for (const thread of threads) {
          const record = thread as {
            id?: unknown;
            members?: unknown;
            meta?: GroupThreadMeta;
            thread_type?: unknown;
          };
          applyDescriptor(
            String(record.id || ''),
            Array.isArray(record.members) ? record.members.map(String) : [],
            record.meta,
            String(record.thread_type || ''),
          );
        }
        pruneThreadMapToAuthoritativeMembership(activeThreadIds);
        return;
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[data:chat] fetchChatThreads hydrate failed, falling back', err);
    }
  }

  if ((shouldUseFirebaseForChat(userId) || !isSupabaseConfigured()) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      const threads = await fb.listFirebaseThreadsForUser(userId);
      for (const thread of threads) {
        applyDescriptor(
          thread.id,
          (thread.member_ids ?? []).map(String),
          (thread.meta ?? {}) as GroupThreadMeta,
          (thread.meta as GroupThreadMeta | undefined)?.kind === 'group' ? 'group' : undefined,
        );
      }
      pruneThreadMapToAuthoritativeMembership(activeThreadIds);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: myMemberships, error } = await supabase
    .from('chat_thread_members')
    .select('thread_id')
    .eq('user_id', userId);
  if (error) return;

  for (const { thread_id: threadId } of myMemberships ?? []) {
    if (!threadId) continue;
    const [{ data: threadRow }, { data: members, error: membersErr }] = await Promise.all([
      supabase.from('chat_threads').select('id, thread_type, meta').eq('id', threadId).maybeSingle(),
      supabase.from('chat_thread_members').select('user_id').eq('thread_id', threadId),
    ]);
    if (membersErr || !members?.length) continue;
    applyDescriptor(
      threadId,
      members.map((row) => row.user_id).filter(Boolean),
      (threadRow?.meta ?? {}) as GroupThreadMeta,
      String(threadRow?.thread_type || ''),
    );
  }
  pruneThreadMapToAuthoritativeMembership(activeThreadIds);
}

function resolvePeerIdForThread(threadId: string, _senderId: string): string | null {
  if (!db.currentUserId || !threadId) return null;
  const map = loadThreadMap();
  return Object.entries(map).find(([, tid]) => tid === threadId)?.[0] ?? null;
}

/** Resolve local chat id from cloud thread — used when thread map is cold on a new device. */
async function resolvePeerIdFromCloudThread(
  threadId: string,
  _senderId: string,
): Promise<string | null> {
  const cached = resolvePeerIdForThread(threadId, '');
  if (cached) return cached;

  const inflight = threadResolveInflight.get(`thread:${threadId}`);
  if (inflight) return inflight;

  const task = (async () => {
    const meId = db.currentUserId;
    if (!meId) return null;

    const applyResolvedThread = (
      members: string[],
      meta: GroupThreadMeta,
      threadType?: string,
    ): string | null => {
      const cleanMembers = [...new Set(members.filter(Boolean))];
      const peers = cleanMembers.filter((id) => id !== meId);
      const isGroup = threadType === 'group' || meta.kind === 'group' || peers.length >= 2;
      if (!isGroup && peers.length === 1) {
        rememberThreadPeer(peers[0], threadId);
        return peers[0];
      }
      if (isGroup && peers.length >= 1) {
        const localId =
          typeof meta.localId === 'string' && meta.localId.trim()
            ? meta.localId.trim()
            : `group_cloud_${threadId.slice(0, 8)}`;
        rememberThreadPeer(localId, threadId);
        db.mergeInboundChatGroup(groupFromThreadMeta(localId, meta, [meId, ...peers]));
        return localId;
      }
      return null;
    };

    const resolveFromSupabase = async (): Promise<string | null> => {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const [{ data: threadRow, error: threadErr }, { data: members, error: membersErr }] = await Promise.all([
        supabase
          .from('chat_threads')
          .select('id, thread_type, meta')
          .eq('id', threadId)
          .maybeSingle(),
        supabase.from('chat_thread_members').select('user_id').eq('thread_id', threadId),
      ]);
      if (threadErr || membersErr || !members?.length) return null;
      return applyResolvedThread(
        members.map((row) => row.user_id).filter(Boolean),
        (threadRow?.meta ?? {}) as GroupThreadMeta,
        String(threadRow?.thread_type || ''),
      );
    };

    const resolveFromFirebase = async (): Promise<string | null> => {
      if (!isFirebaseConfigured()) return null;
      const fb = await firebaseChat();
      if (!fb.isFirebaseChatAvailable()) return null;
      const thread = await fb.fetchFirebaseThread(threadId);
      if (!thread) return null;
      const meta = (thread.meta ?? {}) as GroupThreadMeta;
      return applyResolvedThread(
        (thread.member_ids ?? []).map(String),
        meta,
        meta.kind === 'group' ? 'group' : undefined,
      );
    };

    // Correctness beats guessing: never poison the thread map from sender_id alone.
    // If membership metadata is temporarily unavailable, the next inbox/history sync
    // will resolve the thread rather than leaking a group message into a DM.
    if (isSupabaseConfigured()) {
      return (await resolveFromSupabase()) ?? resolveFromFirebase();
    }
    if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
      return (await resolveFromFirebase()) ?? resolveFromSupabase();
    }
    return resolveFromSupabase();
  })().finally(() => {
    threadResolveInflight.delete(`thread:${threadId}`);
  });

  threadResolveInflight.set(`thread:${threadId}`, task);
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

  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      const threadIds = [...new Set(Object.values(loadThreadMap()))];
      for (const threadId of threadIds) {
        const messages = await fb.fetchFirebaseChatMessages(threadId, 200);
        if (!messages.some((row) => row.id === cloudMessageId)) continue;
        const peerId = resolvePeerIdForThread(threadId, '');
        if (peerId) await syncCloudReactionsForThread(threadId, peerId);
        return;
      }
      return;
    }
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
  if (!isChatCloudAvailable() || !group?.id) return null;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return null;

  const map = loadThreadMap();
  if (map[group.id]) return map[group.id];

  const memberIds = [...new Set((group.memberIds || []).map(String).filter((id) => isCloudAuthUserId(id)))];
  if (!memberIds.includes(meId)) memberIds.push(meId);
  if (memberIds.length < 2) return null;
  const meta = groupThreadMeta({ ...group, memberIds });

  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      const threadId = await fb.createFirebaseChatThread(memberIds, meta);
      if (threadId) rememberThreadPeer(group.id, threadId);
      return threadId;
    }
  }

  if (isPlatformApiAvailable()) {
    try {
      const thread = await createChatThread(memberIds.filter((id) => id !== meId), {
        threadType: 'group',
        meta,
      });
      if (thread?.id) {
        rememberThreadPeer(group.id, thread.id);
        return thread.id;
      }
    } catch (apiErr) {
      console.warn('[cloud-chat] group thread create failed:', apiErr);
    }
  }

  // Direct fallback for local/dev. Insert self membership first to satisfy legacy RLS.
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: thread, error: threadErr } = await supabase
    .from('chat_threads')
    .insert({ thread_type: 'group', dm_key: null, meta })
    .select('id')
    .single();
  if (threadErr || !thread?.id) return null;

  const { error: selfErr } = await supabase.from('chat_thread_members').insert({
    thread_id: thread.id,
    user_id: meId,
  });
  if (selfErr && selfErr.code !== '23505') return null;
  for (const userId of memberIds.filter((id) => id !== meId)) {
    const { error } = await supabase.from('chat_thread_members').insert({
      thread_id: thread.id,
      user_id: userId,
    });
    if (error && error.code !== '23505') {
      console.warn('[cloud-chat] group member add failed:', error.message);
    }
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

  const memberIds = [...new Set((group.memberIds || []).map(String).filter((id) => isCloudAuthUserId(id)))];
  if (!memberIds.includes(meId)) memberIds.push(meId);
  const meta = groupThreadMeta({ ...group, memberIds });

  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      await fb.updateFirebaseThreadMembers(threadId, memberIds, meta);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: existing } = await supabase
    .from('chat_thread_members')
    .select('user_id')
    .eq('thread_id', threadId);
  const existingIds = new Set((existing || []).map((row) => String(row.user_id || '')).filter(Boolean));
  const toAdd = memberIds.filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !memberIds.includes(id));

  for (const userId of toAdd) {
    const { error } = await supabase.from('chat_thread_members').insert({ thread_id: threadId, user_id: userId });
    if (error && error.code !== '23505') console.warn('[cloud-chat] group member add failed:', error.message);
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from('chat_thread_members')
      .delete()
      .eq('thread_id', threadId)
      .in('user_id', toRemove);
    if (error) console.warn('[cloud-chat] group member remove failed:', error.message);
  }
  const { error: metaErr } = await supabase.from('chat_threads').update({ meta }).eq('id', threadId);
  if (metaErr && import.meta.env.DEV) console.warn('[cloud-chat] group metadata update failed:', metaErr.message);
}

export async function leaveCloudGroupThread(groupId: string): Promise<boolean> {
  const group = db.getChatGroup(groupId);
  const meId = db.currentUserId;
  if (!group || !meId) return false;
  if (String(group.createdBy || '') === meId) return false;
  const threadId = loadThreadMap()[groupId] || await ensureCloudThreadForGroup(group);
  if (!threadId) return false;

  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      const thread = await fb.fetchFirebaseThread(threadId);
      if (!thread) return false;
      const nextMembers = (thread.member_ids || []).map(String).filter((id) => id !== meId);
      await fb.updateFirebaseThreadMembers(threadId, nextMembers, thread.meta || {});
      dropLocalThreadMappingByThreadId(threadId);
      return true;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from('chat_thread_members')
    .delete()
    .eq('thread_id', threadId)
    .eq('user_id', meId);
  if (error) return false;
  dropLocalThreadMappingByThreadId(threadId);
  return true;
}

export async function deleteCloudGroupThread(groupId: string): Promise<boolean> {
  const group = db.getChatGroup(groupId);
  const meId = db.currentUserId;
  if (!group || !meId || String(group.createdBy || '') !== meId) return false;
  const threadId = loadThreadMap()[groupId] || await ensureCloudThreadForGroup(group);
  if (!threadId) return false;

  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      await fb.deleteFirebaseChatThread(threadId);
      dropLocalThreadMappingByThreadId(threadId);
      return true;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { error } = await supabase.from('chat_threads').delete().eq('id', threadId);
  if (error) return false;
  dropLocalThreadMappingByThreadId(threadId);
  return true;
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
  void healOutboundDeliveryForChatAsync(chatId);
}

async function healOutboundDeliveryForChatAsync(chatId: string): Promise<void> {
  if (!chatId) return;
  const thread = db.messages[chatId];
  if (!Array.isArray(thread) || thread.length === 0) return;

  const meId = db.currentUserId;
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

    if (age >= SLOW_SEND_MS && meId) {
      const mutationId = String(message.id);
      const outboxItem = await getOutboxItemByMutation(meId, 'chat', mutationId).catch(() => null);
      if (!outboxItem) {
        // Outbox already cleared — server accepted the send but local status lagged.
        db.markMessageDeliveryStatus(chatId, mutationId, 'sent');
        continue;
      }
      if (outboxItem.state !== 'failed') {
        queueCloudMessageSend(chatId, message);
      }
    }
  }

  if (meId) {
    await processChatOutbox(meId).catch(() => undefined);
  }
}

type RemoteChatRow = {
  id?: string;
  sender_id?: string;
  body?: string;
  payload?: Record<string, unknown> | null;
  client_id?: string | null;
  deleted_at?: string | null;
  created_at?: string;
};

function reconcileOutboundDeliveryFromRemoteRows(chatId: string, rows: RemoteChatRow[]): void {
  const meId = db.currentUserId;
  if (!meId || !rows.length) return;
  const thread = db.messages[chatId];
  if (!Array.isArray(thread) || thread.length === 0) return;

  const ackedByClientId = new Map<string, string>();
  for (const row of rows) {
    if (row.sender_id !== meId || !row.id) continue;
    const clientId = row.client_id || (row.payload as { id?: string } | null)?.id;
    if (clientId) ackedByClientId.set(String(clientId), row.id);
  }
  if (!ackedByClientId.size) return;

  for (const message of thread) {
    if (!message.isAuthor || message.deliveryStatus !== 'sending' || !message.id) continue;
    const cloudId = ackedByClientId.get(String(message.id));
    if (!cloudId) continue;
    db.attachCloudMessageId(chatId, String(message.id), cloudId);
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
    try {
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
      const body = bodyFromMessage(withMedia);
      const payload = messageToPayload(withMedia);
      await enqueueChatMessageSend(meId, chatId, threadId, withMedia, body, payload);
    } catch (err) {
      console.warn('[cloud-chat] queue send failed:', err);
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
  if (isAuthor) {
    if (row.deleted_at) {
      applyRemoteMessageDeleted(chatId, row);
      return;
    }
    const localClientId = row.client_id || row.payload?.id;
    if (row.id && localClientId) {
      db.attachCloudMessageId(chatId, String(localClientId), row.id);
    } else if (row.id) {
      const thread = db.messages[chatId];
      if (Array.isArray(thread)) {
        for (const message of thread) {
          if (!message.isAuthor || message.deliveryStatus !== 'sending' || !message.id) continue;
          if (message.cloudId === row.id) {
            db.markMessageDeliveryStatus(chatId, String(message.id), 'sent');
          }
        }
      }
    }
    // Same-account multi-device: merge if this device did not originate the pending send.
    const thread = db.messages[chatId];
    const localId = localClientId ? String(localClientId) : '';
    const alreadyLocal =
      localId &&
      Array.isArray(thread) &&
      thread.some(
        (m) =>
          String(m.id) === localId ||
          (row.id && m.cloudId === row.id) ||
          m.cloudId === row.id,
      );
    if (!alreadyLocal && row.id) {
      const msg = payloadToMessage(
        row.payload,
        row.body ?? '',
        true,
        row.created_at ?? new Date().toISOString(),
        row.id,
        senderId,
      );
      if (localClientId) msg.id = String(localClientId);
      db.mergeInboundMessage(chatId, msg, { bumpUnread: false });
    }
    return;
  }
  // 1:1 chats are keyed by peer id — ignore inserts from unrelated senders.
  // Group chats are keyed by group id — any member may send.
  if (!isGroupChatId(chatId) && senderId !== chatId) return;

  if (row.deleted_at) {
    applyRemoteMessageDeleted(chatId, row);
    dispatchChatInboxActivity(chatId);
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
    (msg.callAction === 'accept' || msg.callAction === 'end' || msg.callAction === 'decline')
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

export async function syncCloudChatHistory(
  chatId: string,
  options?: { before?: string; limit?: number },
): Promise<void> {
  if (!isChatCloudAvailable()) return;
  if (!isGroupChatId(chatId) && !isCloudAuthUserId(chatId)) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const threadId = await ensureCloudThreadForChat(chatId);
  if (!threadId) return;

  const remoteRows: RemoteChatRow[] = [];

  const pullRows = async (
    fetcher: () => Promise<RemoteChatRow[]>,
  ) => {
    const rows = await fetcher().catch(() => []);
    if (!rows.length) return;
    remoteRows.push(...rows);
    if (!isGroupChatId(chatId)) await ensurePeerProfileCached(chatId);
    for (const row of rows) {
      if (!row.sender_id) continue;
      if (isCloudAuthUserId(row.sender_id)) void ensurePeerProfileCached(row.sender_id);
      mergeRemoteMessage(chatId, row, { source: 'history' });
    }
  };

  if (isPlatformApiAvailable()) {
    await pullRows(async () => {
      const page = await fetchChatThreadMessages(threadId, {
        before: options?.before,
        limit: options?.limit ?? 50,
      });
      return (page.messages ?? []) as RemoteChatRow[];
    });
  } else if (isSupabaseConfigured()) {
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
  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      await pullRows(() => fb.fetchFirebaseChatMessages(threadId, 200));
    }
  }

  await syncCloudReactionsForThread(threadId, chatId);
  await syncCloudReadReceipt(chatId, threadId, meId);
  reconcileOutboundDeliveryFromRemoteRows(chatId, remoteRows);
  healOutboundDeliveryForChat(chatId);
}

async function syncCloudReactionsForThread(threadId: string, peerId: string): Promise<void> {
  const meId = db.currentUserId;
  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      const messages = await fb.fetchFirebaseChatMessages(threadId, 200);
      if (!messages.length) return;
      const messageIds = messages.map((m) => m.id).filter(Boolean) as string[];
      if (!messageIds.length) return;
      const reactions = await fb.fetchFirebaseReactionsForThread(threadId, messageIds);
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

  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      data = await fb.fetchFirebaseReadReceipts(threadId);
    }
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
    if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
      const fb = await firebaseChat();
      if (fb.isFirebaseChatAvailable()) {
        await fb.upsertFirebaseReadReceipt(threadId, meId, timestamp);
        return;
      }
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
    if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
      const fb = await firebaseChat();
      if (fb.isFirebaseChatAvailable()) {
        await fb.setFirebaseReaction(threadId, cloudId, meId, emoji);
        return;
      }
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
    if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
      const fb = await firebaseChat();
      if (fb.isFirebaseChatAvailable()) {
        await fb.updateFirebaseChatMessage(
          threadId,
          cloudId,
          bodyFromMessage(message),
          messageToPayload(message),
        );
        return;
      }
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
  action: 'invite' | 'accept' | 'end' | 'decline' = 'invite',
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
          : action === 'accept'
            ? `${kind} call accepted`
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

async function resolveCloudMessageIdForDelete(
  threadId: string,
  meId: string,
  message: ChatMessage,
): Promise<string | null> {
  const fromLocal = String(message.cloudId || '').trim();
  if (fromLocal) return fromLocal;

  const clientId = String(message.id || '').trim();
  if (!clientId) return null;

  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      const rows = await fb.fetchFirebaseChatMessages(threadId, 200);
      const match = rows.find(
        (row) =>
          row.sender_id === meId &&
          (row.client_id === clientId || (row.payload as { id?: string } | null)?.id === clientId),
      );
      if (match?.id) return match.id;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('thread_id', threadId)
    .eq('sender_id', meId)
    .eq('client_id', clientId)
    .maybeSingle();
  return data?.id ?? null;
}

function remoteDeleteLocalId(row: {
  client_id?: string | null;
  payload?: Record<string, unknown> | null;
}): string | undefined {
  const fromClient = row.client_id ? String(row.client_id) : '';
  const fromPayload = (row.payload as { id?: string } | null)?.id;
  const localId = fromClient || (fromPayload ? String(fromPayload) : '');
  return localId || undefined;
}

function applyRemoteMessageDeleted(
  chatId: string,
  row: { id?: string; client_id?: string | null; payload?: Record<string, unknown> | null },
): void {
  if (!row.id) return;
  db.markCloudMessageDeleted(chatId, row.id, remoteDeleteLocalId(row));
}

async function softDeleteCloudMessageByRef(
  threadId: string,
  meId: string,
  message: ChatMessage,
): Promise<{ ok: boolean; cloudId?: string }> {
  const cloudId = String(message.cloudId || '').trim();
  const clientId = String(message.id || '').trim();

  if (shouldUseFirebaseForChat(meId) && isFirebaseConfigured()) {
    const fb = await firebaseChat();
    if (fb.isFirebaseChatAvailable()) {
      let targetId = cloudId;
      if (!targetId && clientId) {
        targetId = (await resolveCloudMessageIdForDelete(threadId, meId, message)) ?? '';
      }
      if (targetId) {
        await fb.softDeleteFirebaseChatMessage(threadId, targetId);
        return { ok: true, cloudId: targetId };
      }
    }
  }

  if (isPlatformApiAvailable()) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const row = await deleteChatMessageApi(threadId, {
          messageId: cloudId || undefined,
          clientId: clientId || undefined,
        });
        if (row?.id) return { ok: true, cloudId: row.id };
      } catch (err) {
        const messageText = err instanceof Error ? err.message : String(err);
        const missing = /\b404\b/.test(messageText) || /not found/i.test(messageText);
        if (missing && attempt < 5) {
          await new Promise((resolve) => window.setTimeout(resolve, 200));
          continue;
        }
        console.warn('[cloud-chat] api delete failed:', messageText);
        break;
      }
    }
  }

  let targetId = cloudId;
  if (!targetId && clientId) {
    targetId = (await resolveCloudMessageIdForDelete(threadId, meId, message)) ?? '';
  }
  if (!targetId) return { ok: false };

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString(), body: 'Message deleted', payload: {} })
    .eq('id', targetId)
    .eq('sender_id', meId);
  if (error) {
    console.warn('[cloud-chat] delete failed:', error.message);
    return { ok: false };
  }
  return { ok: true, cloudId: targetId };
}

export function queueCloudMessageDelete(peerId: string, message: ChatMessage): void {
  if (!message.isAuthor) return;
  if (!isGroupChatId(peerId) && !isCloudAuthUserId(peerId)) return;
  if (!isChatCloudAvailable()) return;
  const meId = db.currentUserId;
  if (!meId) return;
  const clientId = String(message.id || '').trim();

  void (async () => {
    const threadId = await ensureCloudThreadForChat(peerId);
    if (!threadId) return;

    if (clientId) {
      await removeOutboxItemsByMutation(meId, 'chat', clientId).catch(() => undefined);
    }

    const result = await softDeleteCloudMessageByRef(threadId, meId, message);
    if (result.ok && result.cloudId) {
      db.markCloudMessageDeleted(peerId, result.cloudId, clientId || undefined);
    }
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
  // Serialize starts — concurrent calls race removeChannel vs .on() and freeze/blank the UI.
  const run = async () => {
    const startSeq = ++chatRealtimeStartSeq;
    const supabase = getSupabaseClient();

    const authUserId = await resolveCloudChatAuthUserId(userId);
    if (startSeq !== chatRealtimeStartSeq) return;
    if (!authUserId || !isChatCloudAvailable()) return;

    // Idempotent — refresh storms must not tear down a healthy channel.
    if (
      chatRealtimeActiveAuthUserId === authUserId &&
      (realtimeChannel || firebaseRealtimeStop)
    ) {
      return;
    }

    const prevChannel = realtimeChannel;
    realtimeChannel = null;
    chatRealtimeActiveAuthUserId = null;
    firebaseRealtimeStop?.();
    firebaseRealtimeStop = null;
    void firebaseChat().then((fb) => fb.stopFirebaseChatRealtime());
    removeSafeRealtimeChannel(supabase, prevChannel);
    if (startSeq !== chatRealtimeStartSeq) return;

    try {
      await hydrateThreadMapFromCloud(authUserId);
    } catch {
      /* offline — still attach realtime when possible */
    }
    if (startSeq !== chatRealtimeStartSeq) return;

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

    if (
      (shouldUseFirebaseForChat(authUserId) || !isSupabaseConfigured()) &&
      isFirebaseConfigured()
    ) {
      const fb = await firebaseChat();
      if (fb.isFirebaseChatAvailable()) {
        firebaseRealtimeStop = fb.startFirebaseChatRealtime(authUserId, {
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
    }

    if (!supabase) {
      chatRealtimeActiveAuthUserId = authUserId;
      return;
    }
    if (startSeq !== chatRealtimeStartSeq) return;

    const channel = subscribeSafeRealtimeChannel(
      supabase,
      `chat-messages:${authUserId}`,
      (ch) => {
        ch.on(
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
            { event: '*', schema: 'public', table: 'chat_thread_members' },
            (payload) => {
              const row = (payload.new || payload.old) as { thread_id?: string; user_id?: string } | null;
              if (payload.eventType === 'DELETE' && row?.user_id === authUserId && row.thread_id) {
                dropLocalThreadMappingByThreadId(row.thread_id);
              }
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
          );
      },
    );

    if (startSeq !== chatRealtimeStartSeq) {
      removeSafeRealtimeChannel(supabase, channel);
      return;
    }
    realtimeChannel = channel;
    chatRealtimeActiveAuthUserId = authUserId;
  };

  const pending = (chatRealtimeStartInflight ?? Promise.resolve()).then(run, run);
  chatRealtimeStartInflight = pending.catch(() => undefined);
  await pending;
}

export function stopCloudChatRealtime(): void {
  chatRealtimeStartSeq += 1;
  chatRealtimeActiveAuthUserId = null;
  firebaseRealtimeStop?.();
  firebaseRealtimeStop = null;
  void firebaseChat().then((fb) => fb.stopFirebaseChatRealtime());
  removeSafeRealtimeChannel(getSupabaseClient(), realtimeChannel);
  realtimeChannel = null;
}

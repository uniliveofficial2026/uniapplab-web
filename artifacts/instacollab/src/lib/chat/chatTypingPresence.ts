/**
 * Supabase Realtime presence for DM/group typing indicators.
 * HTTP /api/chat/typing remains a fallback when Realtime is unavailable.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';

export type ChatTypingPresencePayload = {
  user_id: string;
  typing: boolean;
  updated_at: number;
};

type TypingListener = (userIds: string[]) => void;

type TypingHub = {
  threadId: string;
  selfUserId: string;
  channel: RealtimeChannel;
  listeners: Set<TypingListener>;
  subscribed: boolean;
};

const hubsByThread = new Map<string, TypingHub>();

function topic(threadId: string): string {
  return `chat-typing:${threadId}`;
}

function typingUserIds(channel: RealtimeChannel, selfId: string): string[] {
  const state = channel.presenceState<ChatTypingPresencePayload>();
  const ids = new Set<string>();
  const now = Date.now();
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      if (!entry?.user_id || entry.user_id === selfId) continue;
      if (!entry.typing) continue;
      if (now - (entry.updated_at || 0) > 8_000) continue;
      ids.add(entry.user_id);
    }
  }
  return Array.from(ids);
}

function emitHub(hub: TypingHub): void {
  const ids = typingUserIds(hub.channel, hub.selfUserId);
  for (const listener of hub.listeners) {
    try {
      listener(ids);
    } catch {
      /* ignore */
    }
  }
}

export function isChatTypingPresenceAvailable(): boolean {
  return isSupabaseConfigured();
}

function ensureTypingHub(threadId: string, selfUserId: string): TypingHub | null {
  const existing = hubsByThread.get(threadId);
  if (existing) return existing;

  const supabase = getSupabaseClient();
  if (!supabase || !threadId || !selfUserId) return null;

  const channel = supabase.channel(topic(threadId), {
    config: { presence: { key: selfUserId } },
  });

  const hub: TypingHub = {
    threadId,
    selfUserId,
    channel,
    listeners: new Set(),
    subscribed: false,
  };

  channel
    .on('presence', { event: 'sync' }, () => emitHub(hub))
    .on('presence', { event: 'join' }, () => emitHub(hub))
    .on('presence', { event: 'leave' }, () => emitHub(hub))
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      hub.subscribed = true;
      try {
        await channel.track({
          user_id: selfUserId,
          typing: false,
          updated_at: Date.now(),
        } satisfies ChatTypingPresencePayload);
      } catch {
        /* best-effort */
      }
      emitHub(hub);
    });

  hubsByThread.set(threadId, hub);
  return hub;
}

export function subscribeChatTypingPresence(
  threadId: string,
  selfUserId: string,
  onTypers: TypingListener,
): RealtimeChannel | null {
  const hub = ensureTypingHub(threadId, selfUserId);
  if (!hub) return null;

  hub.listeners.add(onTypers);
  if (hub.subscribed) emitHub(hub);
  return hub.channel;
}

export async function setChatTypingPresence(
  threadId: string,
  selfUserId: string,
  typing: boolean,
): Promise<void> {
  if (!threadId || !selfUserId) return;
  const hub = ensureTypingHub(threadId, selfUserId);
  if (!hub) return;
  try {
    await hub.channel.track({
      user_id: selfUserId,
      typing,
      updated_at: Date.now(),
    } satisfies ChatTypingPresencePayload);
  } catch {
    /* best-effort */
  }
}

export function unsubscribeChatTypingPresence(threadId: string): void {
  const hub = hubsByThread.get(threadId);
  if (!hub) return;
  hubsByThread.delete(threadId);
  const supabase = getSupabaseClient();
  if (supabase) void supabase.removeChannel(hub.channel);
}

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';

export type PartyRoomChatKind = 'chat' | 'join' | 'gift' | 'system' | 'sing';

export type PartyRoomChatRow = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  kind: PartyRoomChatKind;
  meta: Record<string, unknown>;
  created_at: string;
};

/** Matches the live party chat shape used in Room.tsx / SoloLiveView. */
export type PartyRoomLiveChatMessage = {
  id: string | number;
  user?: string;
  userId?: string;
  text?: string;
  isBurmese?: boolean;
  isJoinEvent?: boolean;
  isGiftEvent?: boolean;
  isSystem?: boolean;
  isSingEvent?: 'start' | 'end';
  isOwner?: boolean;
  isAdmin?: boolean;
  giftName?: string;
  giftIcon?: string;
  giftAmount?: number;
  receiver?: string;
  singerName?: string;
  songTitle?: string;
  score?: number;
  iconBadge?: string;
  isAnnouncementWelcome?: boolean;
  targetViewerId?: string;
  targetViewerName?: string;
  targetViewerAvatar?: string;
  createdAt?: string;
  isStickerEvent?: boolean;
  stickerId?: string;
  stickerAssetUrl?: string;
  stickerLabel?: string;
};

export function kindFromMessage(message: PartyRoomLiveChatMessage): PartyRoomChatKind {
  if (message.isJoinEvent) return 'join';
  if (message.isGiftEvent) return 'gift';
  if (message.isSystem) return 'system';
  if (message.isSingEvent) return 'sing';
  return 'chat';
}

export function metaFromMessage(message: PartyRoomLiveChatMessage): Record<string, unknown> {
  const {
    id: _id,
    user: _user,
    userId: _userId,
    text: _text,
    createdAt: _createdAt,
    ...rest
  } = message;
  return rest;
}

export function rowToLiveChatMessage(row: PartyRoomChatRow): PartyRoomLiveChatMessage {
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    user: row.sender_name,
    userId: row.sender_id,
    text: row.body,
    createdAt: row.created_at,
    isJoinEvent: row.kind === 'join' || Boolean(meta.isJoinEvent),
    isGiftEvent: row.kind === 'gift' || Boolean(meta.isGiftEvent),
    isSystem: row.kind === 'system' || Boolean(meta.isSystem),
    isSingEvent:
      meta.isSingEvent === 'start' || meta.isSingEvent === 'end'
        ? meta.isSingEvent
        : row.kind === 'sing'
          ? 'start'
          : undefined,
    isBurmese: Boolean(meta.isBurmese),
    isOwner: Boolean(meta.isOwner),
    isAdmin: Boolean(meta.isAdmin),
    giftName: typeof meta.giftName === 'string' ? meta.giftName : undefined,
    giftIcon: typeof meta.giftIcon === 'string' ? meta.giftIcon : undefined,
    giftAmount: typeof meta.giftAmount === 'number' ? meta.giftAmount : undefined,
    receiver: typeof meta.receiver === 'string' ? meta.receiver : undefined,
    singerName: typeof meta.singerName === 'string' ? meta.singerName : undefined,
    songTitle: typeof meta.songTitle === 'string' ? meta.songTitle : undefined,
    iconBadge: typeof meta.iconBadge === 'string' ? meta.iconBadge : undefined,
    isStickerEvent: Boolean(meta.isStickerEvent) || meta.type === 'sticker',
    stickerId: typeof meta.stickerId === 'string' ? meta.stickerId : undefined,
    stickerAssetUrl: typeof meta.stickerAssetUrl === 'string' ? meta.stickerAssetUrl : undefined,
    stickerLabel: typeof meta.stickerLabel === 'string' ? meta.stickerLabel : undefined,
  };
}

export async function fetchPartyRoomMessages(
  roomId: string,
  limit = 50,
): Promise<PartyRoomLiveChatMessage[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !roomId) return [];

  const { data, error } = await supabase
    .from('party_room_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as PartyRoomChatRow[]).map(rowToLiveChatMessage);
}

export async function insertPartyRoomMessage(
  roomId: string,
  senderId: string,
  senderName: string,
  message: PartyRoomLiveChatMessage,
): Promise<PartyRoomChatRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !roomId || !senderId) return null;

  const { data, error } = await supabase
    .from('party_room_messages')
    .insert({
      room_id: roomId,
      sender_id: senderId,
      sender_name: senderName.trim() || message.user?.trim() || 'Guest',
      body: String(message.text ?? '').slice(0, 2000),
      kind: kindFromMessage(message),
      meta: metaFromMessage(message),
    })
    .select('*')
    .single();

  if (error) throw error;
  return (data as PartyRoomChatRow) ?? null;
}

export function subscribePartyRoomMessages(
  roomId: string,
  onInsert: (message: PartyRoomLiveChatMessage) => void,
): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase || !roomId) return null;

  const instanceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const channel = supabase
    .channel(`party-room-chat:${roomId}:${instanceId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'party_room_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const row = payload.new as PartyRoomChatRow;
        if (!row?.id) return;
        onInsert(rowToLiveChatMessage(row));
      },
    )
    .subscribe();

  return channel;
}

export function unsubscribePartyRoomChannel(channel: RealtimeChannel | null): void {
  const supabase = getSupabaseClient();
  if (!channel || !supabase) return;
  void supabase.removeChannel(channel);
}

export function isPartyRoomChatCloudAvailable(): boolean {
  return isSupabaseConfigured();
}

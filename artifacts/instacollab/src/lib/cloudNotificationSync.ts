/**
 * Cross-user notification delivery via public.user_notifications + Realtime.
 * Local inbox stays the UI source of truth; cloud is the internet transport.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppNotification, AppNotificationType, LiveKind, Tab } from '../types';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { db } from './db/localDb';
import { getSupabaseClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';
import { fetchProfile, profileRowToUser } from './supabase/profile';
import { insertUserNotification } from './supabase/follows';

type CloudNotificationRow = {
  id: string;
  user_id: string;
  type: string;
  actor_id: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

type NotificationBodyPayload = {
  text?: string;
  title?: string;
  postId?: string;
  reelId?: string;
  link?: string;
  targetTab?: Tab;
  liveKind?: LiveKind;
  postImage?: string;
  orderId?: string;
  taskId?: string | number;
};

const NOTIFICATION_TYPES = new Set<AppNotificationType>([
  'follow',
  'follow_request',
  'like',
  'comment',
  'mention',
  'message',
  'order',
  'system',
  'task',
  'activity',
  'live',
]);

let realtimeChannel: RealtimeChannel | null = null;
let subscribedUserId: string | null = null;

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function parseBody(raw: string | null): NotificationBodyPayload & { text?: string } {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as NotificationBodyPayload;
      return parsed && typeof parsed === 'object' ? parsed : { text: raw };
    } catch {
      return { text: raw };
    }
  }
  return { text: raw };
}

function coerceType(type: string): AppNotificationType {
  return NOTIFICATION_TYPES.has(type as AppNotificationType)
    ? (type as AppNotificationType)
    : 'system';
}

async function ensureActorCached(actorId: string | null | undefined): Promise<void> {
  if (!actorId || !isCloudAuthUserId(actorId)) return;
  if (db.users.some((u) => u.id === actorId)) return;
  const row = await fetchProfile(actorId).catch(() => null);
  if (row) db.cacheDiscoveredUsers([profileRowToUser(row)]);
}

function rowToInbound(row: CloudNotificationRow): Parameters<
  typeof db.mergeInboundCloudNotification
>[1] {
  const body = parseBody(row.body);
  return {
    id: row.id,
    type: coerceType(row.type),
    actorUserId: row.actor_id ?? undefined,
    createdAt: Date.parse(row.created_at) || Date.now(),
    read: Boolean(row.read_at),
    text: body.text,
    title: body.title,
    postId: body.postId,
    reelId: body.reelId,
    link: body.link,
    targetTab: body.targetTab,
    liveKind: body.liveKind,
    postImage: body.postImage,
    orderId: body.orderId,
    taskId: body.taskId,
  };
}

async function applyCloudNotificationRow(row: CloudNotificationRow): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || row.user_id !== meId) return;
  await ensureActorCached(row.actor_id);
  db.mergeInboundCloudNotification(meId, rowToInbound(row));
}

/** Deliver a notification to another cloud user over the internet. */
export function queueCloudNotificationDelivery(
  ownerUserId: string,
  payload: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'user'> & {
    type: AppNotificationType;
  },
): void {
  if (!isSupabaseConfigured()) return;
  const ownerId = String(ownerUserId || '').trim();
  const actorId = String(payload.actorUserId || '').trim();
  if (!isCloudAuthUserId(ownerId) || !isCloudAuthUserId(actorId)) return;
  if (ownerId === actorId) return;

  const body = JSON.stringify({
    text: payload.text,
    title: payload.title,
    postId: payload.postId,
    reelId: payload.reelId,
    link: payload.link,
    targetTab: payload.targetTab,
    liveKind: payload.liveKind,
    postImage: payload.postImage,
    orderId: payload.orderId,
    taskId: payload.taskId,
  } satisfies NotificationBodyPayload);

  void insertUserNotification({
    userId: ownerId,
    type: payload.type,
    actorId,
    body,
  });
}

export async function syncCloudNotifications(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from('user_notifications')
    .select('id, user_id, type, actor_id, body, read_at, created_at')
    .eq('user_id', meId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data?.length) {
    if (error) console.warn('[notifications] sync failed:', error.message);
    return;
  }

  const actorIds = [
    ...new Set(
      data
        .map((row) => (row as CloudNotificationRow).actor_id)
        .filter((id): id is string => !!id && isCloudAuthUserId(id)),
    ),
  ];
  await Promise.all(actorIds.map((id) => ensureActorCached(id)));

  for (const row of data as CloudNotificationRow[]) {
    db.mergeInboundCloudNotification(meId, rowToInbound(row));
  }
}

export function startCloudNotificationRealtime(userId: string): void {
  stopCloudNotificationRealtime();
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  subscribedUserId = userId;
  realtimeChannel = supabase
    .channel(`user-notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: { new: Record<string, unknown> }) => {
        void applyCloudNotificationRow(payload.new as CloudNotificationRow);
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: { new: Record<string, unknown> }) => {
        void applyCloudNotificationRow(payload.new as CloudNotificationRow);
      },
    )
    .subscribe();

  void syncCloudNotifications();
}

export function stopCloudNotificationRealtime(): void {
  const supabase = getSupabaseClient();
  if (realtimeChannel && supabase) {
    void supabase.removeChannel(realtimeChannel);
  }
  realtimeChannel = null;
  subscribedUserId = null;
}

export async function markCloudNotificationRead(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured() || !isUuid(notificationId)) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', meId);

  if (error) console.warn('[notifications] mark read failed:', error.message);
}

export async function markAllCloudNotificationsRead(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', meId)
    .is('read_at', null);

  if (error) console.warn('[notifications] mark all read failed:', error.message);
}

export function isCloudNotificationRealtimeActive(userId: string): boolean {
  return subscribedUserId === userId && !!realtimeChannel;
}

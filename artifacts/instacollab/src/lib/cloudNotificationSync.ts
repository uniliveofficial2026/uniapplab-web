/**
 * Cross-user notification delivery via user_notifications + realtime.
 * Local inbox stays the UI source of truth; cloud is the internet transport.
 */
import type { AppNotification, AppNotificationType, LiveKind, Tab } from '../types';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { db } from './db/localDb';
import { fetchProfile, profileRowToUser } from './supabase/profile';
import {
  fetchCloudNotifications,
  insertUserNotification,
  isNotificationsCloudAvailable,
  markAllCloudNotificationsRead as markAllCloudNotificationsReadRemote,
  markCloudNotificationRead as markCloudNotificationReadRemote,
  subscribeCloudNotifications,
  type CloudNotificationRow,
} from './cloudSocial/notificationsCloud';

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

let unsubscribe: (() => void) | null = null;
let subscribedUserId: string | null = null;

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
  // Reject late events if realtime is still on a prior person after switch/logout.
  if (subscribedUserId && subscribedUserId !== meId) return;
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
  if (!isNotificationsCloudAvailable()) return;
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
  if (!isNotificationsCloudAvailable()) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const data = await fetchCloudNotifications(meId);
  if (!data.length) return;

  const actorIds = [
    ...new Set(
      data
        .map((row) => row.actor_id)
        .filter((id): id is string => !!id && isCloudAuthUserId(id)),
    ),
  ];
  await Promise.all(actorIds.map((id) => ensureActorCached(id)));

  for (const row of data) {
    db.mergeInboundCloudNotification(meId, rowToInbound(row));
  }
}

export function startCloudNotificationRealtime(userId: string): void {
  if (!isNotificationsCloudAvailable() || !isCloudAuthUserId(userId)) return;
  // Idempotent — stop/start storms caused postgres_changes-after-subscribe blanks.
  if (subscribedUserId === userId && unsubscribe) return;

  stopCloudNotificationRealtime();
  subscribedUserId = userId;
  unsubscribe = subscribeCloudNotifications(userId, (row) => {
    void applyCloudNotificationRow(row);
  });

  void syncCloudNotifications();
}

export function stopCloudNotificationRealtime(): void {
  unsubscribe?.();
  unsubscribe = null;
  subscribedUserId = null;
}

export async function markCloudNotificationRead(notificationId: string): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;
  if (!isNotificationsCloudAvailable() || !notificationId) return;

  await markCloudNotificationReadRemote(notificationId, meId).catch((err) => {
    console.warn('[notifications] mark read failed:', err);
  });
}

export async function markAllCloudNotificationsRead(): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId) || !isNotificationsCloudAvailable()) return;
  await markAllCloudNotificationsReadRemote(meId).catch((err) => {
    console.warn('[notifications] mark all read failed:', err);
  });
}

export function isCloudNotificationRealtimeActive(userId: string): boolean {
  return subscribedUserId === userId && !!unsubscribe;
}

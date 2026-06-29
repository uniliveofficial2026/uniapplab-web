import type { AppNotification, AppNotificationType, LiveKind, User } from '../types';
import { LIVE_KIND_LABELS } from './liveRing';

export function formatNotificationTime(
  createdAt: number,
  now = Date.now()
): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return 'Recently';
  const deltaSec = Math.max(0, Math.floor((now - createdAt) / 1000));
  if (deltaSec < 60) return 'Just now';
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  if (deltaSec < 604800) return `${Math.floor(deltaSec / 86400)}d ago`;
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function notificationDedupeKey(
  n: Pick<
    AppNotification,
    | 'type'
    | 'actorUserId'
    | 'postId'
    | 'reelId'
    | 'orderId'
    | 'taskId'
    | 'link'
    | 'liveKind'
    | 'text'
    | 'title'
  >
): string {
  return [
    n.type,
    n.actorUserId ?? '',
    n.postId ?? '',
    n.reelId ?? '',
    n.orderId ?? '',
    n.taskId != null ? String(n.taskId) : '',
    n.link ?? '',
    n.liveKind ?? '',
    (n.title ?? '').slice(0, 40),
    (n.text ?? '').slice(0, 80),
  ].join('|');
}

export function notificationMessage(
  notification: AppNotification,
  actor?: User | null
): string {
  const name = actor?.username ? `@${actor.username}` : 'Someone';
  switch (notification.type) {
    case 'follow':
      return `${name} started following you.`;
    case 'like':
      return notification.reelId
        ? `${name} liked your reel.`
        : `${name} liked your post.`;
    case 'comment':
      return `${name} commented: ${notification.text ?? ''}`.trim();
    case 'mention':
      return `${name} ${notification.text ?? 'mentioned you.'}`.trim();
    case 'message':
      return `${name} shared an item with you: ${notification.text ?? ''}`.trim();
    case 'order':
      return notification.text ?? 'Your order was confirmed.';
    case 'system':
      return notification.text ?? notification.title ?? 'System update';
    case 'task':
      return notification.text ?? notification.title ?? 'Workspace task update';
    case 'activity':
      return notification.text ?? notification.title ?? 'Workspace activity';
    case 'live':
      return notification.text ?? notification.title ?? 'Live update';
    default:
      return notification.text ?? '';
  }
}

export function liveNotificationKindLabel(liveKind?: LiveKind): string {
  if (!liveKind) return 'Live';
  return LIVE_KIND_LABELS[liveKind] ?? 'Live';
}

export function isLiveNotification(notification: AppNotification): boolean {
  return notification.type === 'live';
}

export function isTaskNotification(notification: AppNotification): boolean {
  return notification.type === 'task';
}

export function isActivityNotification(notification: AppNotification): boolean {
  return notification.type === 'activity';
}

export function isMentionNotification(notification: AppNotification): boolean {
  if (notification.type === 'mention') return true;
  if (notification.type === 'comment' || notification.type === 'message') {
    const t = notification.text ?? '';
    return t.includes('@');
  }
  return false;
}

export type NotificationTypeFilter = 'all' | AppNotificationType;

export const NOTIFICATION_TYPE_FILTER_ORDER: AppNotificationType[] = [
  'follow',
  'like',
  'comment',
  'mention',
  'message',
  'task',
  'activity',
  'live',
  'order',
  'system',
];

export function notificationTypeFilterLabel(type: AppNotificationType): string {
  switch (type) {
    case 'follow':
      return 'Follows';
    case 'like':
      return 'Likes';
    case 'comment':
      return 'Comments';
    case 'mention':
      return 'Mentions';
    case 'message':
      return 'Messages';
    case 'order':
      return 'Orders';
    case 'system':
      return 'Updates';
    case 'task':
      return 'Tasks';
    case 'activity':
      return 'Activity';
    case 'live':
      return 'Live';
    default:
      return type;
  }
}

export type NotificationFeedTab =
  | 'all'
  | 'mentions'
  | 'tasks'
  | 'activity'
  | 'live';

export function matchesNotificationFeedTab(
  notification: AppNotification,
  tab: NotificationFeedTab
): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'mentions':
      return isMentionNotification(notification);
    case 'tasks':
      return isTaskNotification(notification);
    case 'activity':
      return isActivityNotification(notification);
    case 'live':
      return isLiveNotification(notification);
    default:
      return true;
  }
}

/** Lowercase text used for inbox search matching. */
export function notificationSearchHaystack(
  notification: AppNotification,
  actor?: Pick<User, 'username' | 'displayName'> | null
): string {
  const parts = [
    actor?.username,
    actor?.displayName,
    notification.title,
    notification.text,
    notification.orderId,
    notification.liveKind
      ? liveNotificationKindLabel(notification.liveKind)
      : '',
    notificationTypeFilterLabel(notification.type),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

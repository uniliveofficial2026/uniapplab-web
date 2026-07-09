/**
 * Browser pop-out notifications (Web Notifications API) for chat + inbox alerts.
 */
import { db } from '../db/localDb';
import { APP_DISPLAY_NAME } from '../appBrand';
import { resolveUser } from '../safe';
import type { AppNotification } from '../../types';

export function isPopoutNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPopoutNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPopoutNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestChatPopoutPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPopoutNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function notificationsEnabledInSettings(): boolean {
  return db.settings?.notificationsEnabled !== false;
}

export function shouldShowChatPopout(chatId: string, activeChatId: string | null): boolean {
  if (!notificationsEnabledInSettings()) return false;
  if (!isPopoutNotificationSupported() || Notification.permission !== 'granted') return false;
  if (document.hidden) return true;
  if (activeChatId !== chatId) return true;
  return false;
}

export function showChatPopoutNotification(options: {
  title: string;
  body: string;
  chatId: string;
  tag?: string;
}): void {
  if (!shouldShowChatPopout(options.chatId, getActiveChatViewId())) return;
  try {
    const notification = new Notification(options.title, {
      body: options.body.slice(0, 240),
      tag: options.tag ?? `chat-${options.chatId}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      silent: false,
    });
    notification.onclick = () => {
      window.focus();
      window.dispatchEvent(
        new CustomEvent('navigate', {
          detail: { tab: 'messages', chatId: options.chatId },
        }),
      );
      notification.close();
    };
  } catch {
    /* quota / blocked */
  }
}

export function showInboxPopoutNotification(row: AppNotification): void {
  if (!notificationsEnabledInSettings()) return;
  if (!isPopoutNotificationSupported() || Notification.permission !== 'granted') return;
  if (!document.hidden && row.targetTab !== 'messages') return;

  const actor = row.actorUserId
    ? resolveUser(db.users, db.users.find((u) => u.id === row.actorUserId))
    : row.user;
  const title =
    row.title ||
    (row.type === 'message'
      ? actor?.displayName || 'New message'
      : APP_DISPLAY_NAME);
  const body = String(row.text ?? '').trim() || 'You have a new notification';

  try {
    const notification = new Notification(title, {
      body: body.slice(0, 240),
      tag: `inbox-${row.id}`,
      icon: '/icons/icon-192.png',
    });
    notification.onclick = () => {
      window.focus();
      const link = row.link ?? '';
      const chatMatch = /^chat:(.+)$/.exec(link);
      if (chatMatch) {
        window.dispatchEvent(
          new CustomEvent('navigate', {
            detail: { tab: 'messages', chatId: chatMatch[1] },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('navigate', {
            detail: { tab: row.targetTab ?? 'notifications' },
          }),
        );
      }
      notification.close();
    };
  } catch {
    /* ignore */
  }
}

let activeChatViewId: string | null = null;

export function setActiveChatViewId(chatId: string | null): void {
  activeChatViewId = chatId;
}

export function getActiveChatViewId(): string | null {
  return activeChatViewId;
}

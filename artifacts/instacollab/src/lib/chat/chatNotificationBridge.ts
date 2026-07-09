/**
 * In-app inbox + browser pop-out for inbound chat messages (Realtime lane).
 */
import { db } from '../db/localDb';
import { resolveUser, findUserById } from '../safe';
import { isGroupChatId } from './cloudChatSync';
import type { ChatMessage } from '../dbTypes';
import {
  getActiveChatViewId,
  requestChatPopoutPermission,
  setActiveChatViewId,
  showChatPopoutNotification,
} from './chatPopoutNotifications';

export { setActiveChatViewId, requestChatPopoutPermission };

function buildInboundPreview(message: ChatMessage): string {
  const text = String(message.text ?? '').trim();
  if (text) return text.slice(0, 120);
  const media = Array.isArray(message.media) ? message.media : [];
  if (media.length) {
    const first = media[0] as { isAudio?: boolean; isVideo?: boolean; isFile?: boolean; name?: string };
    if (first?.isAudio) return 'Sent an audio message';
    if (first?.isVideo) return 'Sent a video';
    if (first?.isFile) return first.name ? `Sent ${first.name}` : 'Sent a file';
    return 'Sent a photo';
  }
  if (message.location) return 'Shared a location';
  return 'Sent you a message';
}

function resolveActorId(chatId: string, message: ChatMessage): string {
  const from = typeof message.from === 'string' ? message.from.trim() : '';
  if (from) return from;
  if (!isGroupChatId(chatId)) return chatId;
  return '';
}

function shouldNotifyInbound(chatId: string): boolean {
  if (document.hidden) return true;
  return getActiveChatViewId() !== chatId;
}

export function notifyInboundChatMessage(chatId: string, message: ChatMessage): void {
  if (!chatId || !message || message.isAuthor) return;
  const meId = db.currentUserId;
  if (!meId) return;

  const preview = buildInboundPreview(message);
  const actorId = resolveActorId(chatId, message);
  const actor = actorId ? resolveUser(db.users, findUserById(db.users, actorId)) : null;
  const title = isGroupChatId(chatId)
    ? actor?.displayName
      ? `${actor.displayName} · Group`
      : 'Group message'
    : actor?.displayName || 'New message';

  if (shouldNotifyInbound(chatId)) {
    showChatPopoutNotification({
      title,
      body: preview,
      chatId,
      tag: `chat-msg-${message.id ?? message.cloudId ?? Date.now()}`,
    });
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: `${title}: ${preview}`,
      }),
    );
  }
}

let installed = false;

export function installChatNotificationBridge(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('chat-inbound-message', (event) => {
    const detail = (event as CustomEvent<{ chatId?: string; message?: ChatMessage }>).detail;
    if (!detail?.chatId || !detail.message) return;
    notifyInboundChatMessage(detail.chatId, detail.message);
  });
}

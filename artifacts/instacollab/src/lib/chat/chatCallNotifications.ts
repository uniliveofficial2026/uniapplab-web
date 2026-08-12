/**
 * Browser pop-out + in-app alerts for incoming chat calls (CallKit-style).
 */
import { db } from '../db/localDb';
import { resolveUser, findUserById } from '../safe';
import {
  callKindLabel,
  normalizeCallKind,
  resolveCallPeer,
  type ChatCallKind,
  type IncomingChatCall,
} from './chatCallKit';
import {
  getPopoutNotificationPermission,
  isPopoutNotificationSupported,
  requestChatPopoutPermission,
} from './chatPopoutNotifications';
import { resolveAppNotificationIcon } from '../appBrand';

export { requestChatPopoutPermission };

function notificationsEnabled(): boolean {
  return db.settings?.notificationsEnabled !== false;
}

function shouldPopoutIncomingCall(): boolean {
  if (!notificationsEnabled()) return false;
  if (!isPopoutNotificationSupported()) return false;
  return getPopoutNotificationPermission() === 'granted';
}

export function notifyIncomingChatCall(detail: IncomingChatCall): void {
  if (!detail?.chatId || !detail.fromUserId) return;
  const meId = db.currentUserId;
  if (!meId || detail.fromUserId === meId) return;

  const callKind = normalizeCallKind(detail.callKind);
  const actor = resolveUser(db.users, findUserById(db.users, detail.fromUserId));
  const peer = resolveCallPeer(detail.chatId, detail.fromUserId);
  const isGroup = !!detail.isGroup || !!(peer && 'isGroup' in peer);
  const title = isGroup
    ? actor?.displayName
      ? `${callKindLabel(callKind)} · ${actor.displayName}`
      : `Incoming group ${callKind} call`
    : actor?.displayName || `Incoming ${callKind} call`;
  const body = isGroup
    ? peer && 'isGroup' in peer
      ? `${peer.displayName}${peer.memberIds?.length ? ` · ${peer.memberIds.length} members` : ''}`
      : 'Tap to answer'
    : callKindLabel(callKind);

  db.pushNotificationForUser(meId, {
    type: 'activity',
    actorUserId: detail.fromUserId,
    title,
    text: body,
    link: `chat:${detail.chatId}`,
    targetTab: 'messages',
  });

  if (shouldPopoutIncomingCall()) {
    try {
      const notification = new Notification(title, {
        body: body.slice(0, 240),
        tag: `chat-call-${detail.chatId}-${detail.callRoomName ?? callKind}`,
        icon: resolveAppNotificationIcon(),
        requireInteraction: true,
        silent: false,
      });
      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(
          new CustomEvent('navigate', {
            detail: { tab: 'messages', chatId: detail.chatId },
          }),
        );
        notification.close();
      };
    } catch {
      /* blocked */
    }
  }

  window.dispatchEvent(
    new CustomEvent('app-toast', {
      detail: `${title} — tap Messages to answer`,
    }),
  );
}

let installed = false;

export function installChatCallNotificationBridge(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('chat-call-invite', (event) => {
    const detail = (event as CustomEvent<IncomingChatCall>).detail;
    if (!detail?.chatId || !detail.fromUserId) return;
    notifyIncomingChatCall(detail);
  });
}

import type { SharePayload } from './shareLinks';
import { formatShareMessage } from './shareLinks';
import { safeUserId } from './safe';
import type { AppNotificationType, Tab } from '../types';

type ShareDb = {
  currentUser?: { id?: string | null } | null;
  addMessage: (chatId: string, message: { text?: string; isAuthor?: boolean }) => void;
  pushNotificationForUser: (
    userId: string,
    payload: {
      type: AppNotificationType;
      actorUserId: string;
      text: string;
      link: string;
      targetTab?: Tab;
    },
  ) => unknown;
};

/** Send a structured share to one or more users with matching DM + notification payloads. */
export function sendShareToUsers(
  db: ShareDb,
  recipientIds: string[],
  payload: SharePayload,
): void {
  const meId = safeUserId(db.currentUser?.id);
  if (!meId) return;

  const messageText = formatShareMessage(payload.shareText, payload.shareUrl);

  recipientIds.forEach((userId) => {
    db.addMessage(userId, {
      text: messageText,
      isAuthor: true,
    });
    db.pushNotificationForUser(userId, {
      type: 'message' as AppNotificationType,
      actorUserId: meId,
      text: payload.notificationText,
      link: payload.shareUrl,
      targetTab: 'messages' as Tab,
    });
  });
}

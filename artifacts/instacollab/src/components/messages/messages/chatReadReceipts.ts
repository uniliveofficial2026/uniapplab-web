import type { ChatPresenceEntry } from '../../../types';
import { getMessageTimestampMs } from './messageTime';

export function normalizeActiveChatId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return value;
}

export function isUserActiveInChat(presence: ChatPresenceEntry | undefined, chatId: string | null): boolean {
  if (!chatId) return false;
  return normalizeActiveChatId(presence?.activeChatId) === chatId;
}

/** Both participants have this DM open (activeChatId matches chat). */
export function areBothParticipantsInChat(
  chatId: string | null,
  myPresence: ChatPresenceEntry | undefined,
  peerPresence: ChatPresenceEntry | undefined
): boolean {
  if (!chatId) return false;
  return isUserActiveInChat(myPresence, chatId) && isUserActiveInChat(peerPresence, chatId);
}

/** Whether read/seen labels should update live for this thread. */
export function isChatReceiptLive(viewerInActiveChat: boolean): boolean {
  return viewerInActiveChat;
}

/** Watermark for incoming Read/Unread labels. */
export function getIncomingReadLabelWatermark(
  chatId: string | null,
  chatLastReadAt: Record<string, number>,
  readLabelCapByChatId: Record<string, number>,
  bothInChat: boolean,
  options?: { viewerInActiveChat?: boolean; isGroup?: boolean },
): number {
  if (!chatId) return 0;
  const selfReadAt = chatLastReadAt[chatId] || 0;
  const viewerInActiveChat = !!options?.viewerInActiveChat;
  const isGroup = !!options?.isGroup;
  if (viewerInActiveChat && (isGroup || bothInChat)) return selfReadAt;
  if (bothInChat) return selfReadAt;
  const cap = readLabelCapByChatId[chatId];
  return typeof cap === 'number' ? cap : selfReadAt;
}

export function isIncomingMessageReadForDisplay(
  messageTimestamp: unknown,
  labelWatermark: number,
  receiptLive: boolean,
): boolean {
  if (!receiptLive || labelWatermark <= 0) return false;
  const ts = getMessageTimestampMs(messageTimestamp);
  if (ts > 0) return labelWatermark >= ts;
  return receiptLive;
}

export function isOutgoingMessageSeen(
  messageTimestamp: unknown,
  peerReadAt: number,
  receiptLive: boolean,
): boolean {
  if (!receiptLive || peerReadAt <= 0) return false;
  const ts = getMessageTimestampMs(messageTimestamp);
  if (ts > 0) return peerReadAt >= ts;
  return true;
}

export function newestMessageTimestampMs(
  thread: Array<{ timestamp?: unknown }>
): number {
  return thread.reduce((maxValue: number, message) => {
    const value = getMessageTimestampMs(message?.timestamp);
    return value > maxValue ? value : maxValue;
  }, 0);
}

/** Merge React state + persisted store so UI never lags behind IDB. */
export function getEffectivePeerReadAt(
  chatId: string | null,
  chatPeerReadAt: Record<string, number>,
  persistedPeerReadAt: number,
): number {
  if (!chatId) return 0;
  const fromState = typeof chatPeerReadAt[chatId] === 'number' ? chatPeerReadAt[chatId] : 0;
  return Math.max(fromState, persistedPeerReadAt);
}

export function isOutgoingSeenInList(messageTimestamp: unknown, peerReadAt: number): boolean {
  if (peerReadAt <= 0) return false;
  const ts = getMessageTimestampMs(messageTimestamp);
  return ts > 0 ? peerReadAt >= ts : false;
}

export function isIncomingReadInList(messageTimestamp: unknown, readAt: number): boolean {
  if (readAt <= 0) return false;
  const ts = getMessageTimestampMs(messageTimestamp);
  return ts > 0 ? readAt >= ts : false;
}

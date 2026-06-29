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

/** Watermark for incoming Read/Unread labels (frozen while you are alone in the thread). */
export function getIncomingReadLabelWatermark(
  chatId: string | null,
  chatLastReadAt: Record<string, number>,
  readLabelCapByChatId: Record<string, number>,
  bothInChat: boolean
): number {
  if (!chatId) return 0;
  const selfReadAt = chatLastReadAt[chatId] || 0;
  if (bothInChat) return selfReadAt;
  const cap = readLabelCapByChatId[chatId];
  return typeof cap === 'number' ? cap : selfReadAt;
}

export function isIncomingMessageReadForDisplay(
  messageTimestamp: unknown,
  labelWatermark: number,
  bothInChat: boolean
): boolean {
  if (labelWatermark <= 0) return false;
  const ts = getMessageTimestampMs(messageTimestamp);
  if (ts > 0) return labelWatermark >= ts;
  return bothInChat;
}

export function isIncomingMessageRead(
  messageTimestamp: unknown,
  selfReadAt: number,
  bothInChat: boolean
): boolean {
  if (!bothInChat || selfReadAt <= 0) return false;
  const ts = getMessageTimestampMs(messageTimestamp);
  if (ts > 0) return selfReadAt >= ts;
  return true;
}

export function isOutgoingMessageSeen(
  messageTimestamp: unknown,
  peerReadAt: number,
  bothInChat: boolean
): boolean {
  if (!bothInChat || peerReadAt <= 0) return false;
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
  persistedPeerReadAt: number
): number {
  if (!chatId) return 0;
  const fromState = typeof chatPeerReadAt[chatId] === 'number' ? chatPeerReadAt[chatId] : 0;
  return Math.max(fromState, persistedPeerReadAt);
}

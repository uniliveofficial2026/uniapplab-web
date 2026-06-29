import type { ChatMessage } from '../../../types';
import { getMessageTimestampMs } from './messageTime';

export function getChatUnreadCount(
  messages: Record<string, ChatMessage[]>,
  chatLastReadAt: Record<string, number>,
  chatId: string
): number {
  const thread = Array.isArray(messages[chatId]) ? messages[chatId] : [];
  const readAt = chatLastReadAt[chatId] || 0;
  return thread.filter((message: ChatMessage) => {
    if (message?.isAuthor) return false;
    const messageTs = getMessageTimestampMs(message?.timestamp);
    return messageTs > readAt;
  }).length;
}

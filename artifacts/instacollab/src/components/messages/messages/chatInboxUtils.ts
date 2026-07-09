import type { ChatGroup, ChatMessage } from '../../../types';
import { getMessageTimestampMs } from './messageTime';

export function getChatLastActivityMs(
  messages: Record<string, ChatMessage[]>,
  chatId: string,
): number {
  const thread = Array.isArray(messages[chatId]) ? messages[chatId] : [];
  if (!thread.length) return 0;
  return getMessageTimestampMs(thread[thread.length - 1]?.timestamp);
}

export function sortChatsByLastActivity<T extends { id: string }>(
  items: T[],
  messages: Record<string, ChatMessage[]>,
): T[] {
  return [...items].sort((a, b) => {
    const delta = getChatLastActivityMs(messages, b.id) - getChatLastActivityMs(messages, a.id);
    if (delta !== 0) return delta;
    return a.id.localeCompare(b.id);
  });
}

export function collectThreadMapPeerIds(
  threadMap: Record<string, string>,
  options: { currentUserId: string; groupIds: Set<string> },
): string[] {
  return Object.keys(threadMap).filter(
    (id) => id && id !== options.currentUserId && !options.groupIds.has(id),
  );
}

export function mergeGroupsFromThreadMap(
  groups: ChatGroup[],
  threadMap: Record<string, string>,
): ChatGroup[] {
  const known = new Set(groups.map((g) => g.id));
  const extras: ChatGroup[] = [];
  for (const chatId of Object.keys(threadMap)) {
    if (known.has(chatId) || !chatId.startsWith('group')) continue;
    extras.push({
      id: chatId,
      displayName: 'Group chat',
      username: 'Group',
      avatarUrl:
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100',
      isGroup: true,
      memberIds: [],
      createdBy: '',
      adminIds: [],
      mutedMemberIds: [],
      adminOnlyPosting: false,
      requireApprovalToJoin: false,
    });
  }
  return extras.length ? [...groups, ...extras] : groups;
}

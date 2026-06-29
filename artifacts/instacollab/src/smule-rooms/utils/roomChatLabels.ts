import type { RoomSelfIdentity } from './selfIdentity';
import { isRoomSelfName } from './selfIdentity';

export type ChatAuthorLike = {
  id: string;
  name: string;
};

/** @-prefixed chat label from resolved author + optional raw message prefix (e.g. 🎤). */
export function formatRoomChatUserLabel(
  author: ChatAuthorLike,
  self: RoomSelfIdentity,
  rawUserLabel?: string,
): string {
  const trimmed = rawUserLabel?.trim() ?? '';
  const prefix = trimmed.startsWith('🎤 ') ? '🎤 ' : '';
  const displayName = author.id === self.id || isRoomSelfName(trimmed, self) ? self.chatLabel : author.name;
  return `${prefix}@${displayName}`;
}

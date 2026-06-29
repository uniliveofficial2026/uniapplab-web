import type { ChatPresenceEntry } from '../../../types';

/** Idle time before typing indicator clears (matches compose auto-clear). */
export const TYPING_IDLE_MS = 4_000;

export function resolveUserTyping(
  userId: string,
  localTypingByUserId: Record<string, boolean>,
  getPresence: (id: string) => ChatPresenceEntry | undefined
): boolean {
  if (!userId) return false;
  return !!localTypingByUserId[userId] || !!getPresence(userId)?.typing;
}

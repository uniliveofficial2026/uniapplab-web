/**
 * Cross-user blocks — enforced for both blocker and blocked via shared table.
 */
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { db } from '../db/localDb';
import {
  deleteCloudBlock,
  fetchBlocksForUser,
  isBlocksCloudAvailable,
  subscribeCloudBlocks,
  upsertCloudBlock,
} from './blocksCloud';

let unsubscribe: (() => void) | null = null;
let subscribedUserId: string | null = null;
let blockedByMe = new Set<string>();
let blockedMe = new Set<string>();

export function isCloudBlockedEitherWay(userId: string): boolean {
  return blockedByMe.has(userId) || blockedMe.has(userId);
}

export function getCloudBlockedUserIds(): string[] {
  return [...blockedByMe];
}

export async function syncCloudBlocks(): Promise<void> {
  if (!isBlocksCloudAvailable()) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const { blockedByMe: mine, blockedMe: against } = await fetchBlocksForUser(meId);
  blockedByMe = new Set(mine);
  blockedMe = new Set(against);

  const localIds = db.getBlockedUserIds?.() ?? [];
  for (const id of blockedByMe) {
    if (!localIds.includes(id)) {
      db.mergeInboundBlock(id, true);
    }
  }
  db.replaceCloudBlocks([...blockedByMe]);
}

export function queueCloudBlock(targetUserId: string, blocked: boolean): void {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId) || !isCloudAuthUserId(targetUserId)) return;
  if (!isBlocksCloudAvailable()) return;

  if (blocked) {
    blockedByMe.add(targetUserId);
    void upsertCloudBlock(meId, targetUserId).catch((err) => {
      console.warn('[blocks] upsert failed:', err);
    });
    return;
  }

  blockedByMe.delete(targetUserId);
  void deleteCloudBlock(meId, targetUserId).catch((err) => {
    console.warn('[blocks] delete failed:', err);
  });
}

export function startCloudBlocksRealtime(userId: string): () => void {
  if (!isBlocksCloudAvailable() || !isCloudAuthUserId(userId)) return () => {};
  if (subscribedUserId === userId && unsubscribe) return stopCloudBlocksRealtime;

  stopCloudBlocksRealtime();
  subscribedUserId = userId;
  void syncCloudBlocks();
  unsubscribe = subscribeCloudBlocks(userId, () => {
    void syncCloudBlocks();
  });

  return stopCloudBlocksRealtime;
}

export function stopCloudBlocksRealtime(): void {
  unsubscribe?.();
  unsubscribe = null;
  subscribedUserId = null;
}

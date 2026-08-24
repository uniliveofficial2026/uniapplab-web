import { db } from '../db/localDb';
import { findUserById, resolveUser } from '../safe';

export type CallAddFriendResult =
  | 'added'
  | 'requested'
  | 'already'
  | 'cancelled_request'
  | 'failed';

export function performCallAddFriend(userId: string): CallAddFriendResult {
  const id = String(userId || '').trim();
  if (!id || id === db.currentUserId) return 'failed';

  const user = resolveUser(db.users, findUserById(db.users, id));
  if (!user) return 'failed';

  const before = db.getFollowActionState(id);
  if (before.isFollowing) return 'already';

  if (before.isRequested) {
    db.toggleFollow(id);
    return db.hasPendingFollowRequest(id) ? 'failed' : 'cancelled_request';
  }

  const next = db.toggleFollow(id);
  if (next === true) return 'added';

  const after = db.getFollowActionState(id);
  if (after.isRequested) return 'requested';
  if (after.isFollowing) return 'added';
  return 'failed';
}

export function getCallAddFriendButtonLabel(userId: string): string {
  const state = db.getFollowActionState(userId);
  if (state.isFollowing) return 'Following';
  if (state.isRequested) return 'Requested';
  return 'Add Friend';
}

export function shouldShowCallAddFriendCard(userId: string): boolean {
  const id = String(userId || '').trim();
  if (!id || id === db.currentUserId) return false;
  return !db.getFollowActionState(id).isFollowing;
}

export function isCallAddFriendDisabled(userId: string): boolean {
  const state = db.getFollowActionState(userId);
  return state.isFollowing || state.isRequested;
}

export function showCallAddFriendToast(
  result: CallAddFriendResult,
  displayName?: string | null,
): void {
  if (typeof window === 'undefined') return;
  const name = String(displayName || '').trim() || 'them';
  const message =
    result === 'added'
      ? `You're now following ${name}.`
      : result === 'requested'
        ? `Follow request sent to ${name}.`
        : result === 'already'
          ? `You're already following ${name}.`
          : result === 'cancelled_request'
            ? 'Follow request cancelled.'
            : result === 'failed'
              ? `Couldn't add ${name} right now.`
              : null;
  if (!message) return;
  window.dispatchEvent(new CustomEvent('app-toast', { detail: message }));
}

export function handleCallAddFriendEvent(detail: { userId?: string } | null | undefined): void {
  const userId = String(detail?.userId || '').trim();
  if (!userId) return;
  const user = resolveUser(db.users, findUserById(db.users, userId));
  const result = performCallAddFriend(userId);
  showCallAddFriendToast(result, user?.displayName || user?.username);
}

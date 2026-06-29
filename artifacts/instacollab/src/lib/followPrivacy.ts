/** Follow / private-account UI helpers (logic lives in db.followBlocked). */

export type FollowActionState = {
  isFollowing: boolean;
  isRequested: boolean;
  canViewContent: boolean;
  isPrivate: boolean;
};

export function getFollowButtonLabel(state: Pick<FollowActionState, 'isFollowing' | 'isRequested'>): string {
  if (state.isFollowing) return 'Following';
  if (state.isRequested) return 'Requested';
  return 'Follow';
}

export function getFollowButtonHoverLabel(
  state: Pick<FollowActionState, 'isFollowing' | 'isRequested'>,
  hover: boolean
): string {
  if (!hover) return getFollowButtonLabel(state);
  if (state.isFollowing) return 'Unfollow';
  if (state.isRequested) return 'Cancel request';
  return 'Follow';
}

export function followToggleToastMessage(
  state: Pick<FollowActionState, 'isFollowing' | 'isRequested'>,
  username: string
): string {
  const label = username || 'user';
  if (state.isFollowing) return `Following ${label}`;
  if (state.isRequested) return `Follow request sent to ${label}`;
  return `Unfollowed ${label}`;
}

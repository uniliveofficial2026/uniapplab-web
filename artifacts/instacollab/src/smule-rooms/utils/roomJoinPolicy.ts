export type RoomJoinContext = {
  /** Logged-in user follows the room owner */
  followsOwner: boolean;
  /** Room owner follows the logged-in user (owner's circle) */
  inOwnerCircle: boolean;
  isElite: boolean;
};

export function seatJoinRequiresApproval(whoCanBeSeated: string | undefined): boolean {
  return (whoCanBeSeated?.trim() ?? 'Anyone') !== 'Anyone';
}

export function whoCanBeSeatedFromApprovalRequired(requiresApproval: boolean): string {
  return requiresApproval ? 'Followers' : 'Anyone';
}

function normalizeJoinPolicy(policy: string | undefined): string {
  const trimmed = policy?.trim() ?? 'Anyone';
  if (trimmed === "Room Owner's Following") return 'OwnerCircle';
  if (trimmed === 'Following') return 'Following';
  if (trimmed === 'Private Key Required') return 'PrivateKeyRequired';
  return trimmed;
}

export function canUserJoinRoom(
  whoCanJoin: string | undefined,
  user: RoomJoinContext,
): { allowed: boolean; reason?: string } {
  const policy = normalizeJoinPolicy(whoCanJoin);
  if (policy === 'Anyone') return { allowed: true };

  if (policy === 'PrivateKeyRequired') {
    return {
      allowed: false,
      reason: 'This private room requires a room key.',
    };
  }

  if (policy === 'Following') {
    if (user.followsOwner) return { allowed: true };
    return { allowed: false, reason: 'Only users following this room can join.' };
  }

  if (policy === 'OwnerCircle') {
    if (user.inOwnerCircle) return { allowed: true };
    return {
      allowed: false,
      reason: "Only users in the room owner's circle can join.",
    };
  }

  if (user.followsOwner || user.inOwnerCircle) return { allowed: true };
  return {
    allowed: false,
    reason: "Only users following the room owner's circle can join.",
  };
}

export function canUserTakeSeat(
  whoCanBeSeated: string | undefined,
  user: RoomJoinContext,
): { allowed: boolean; reason?: string } {
  const policy = whoCanBeSeated?.trim() ?? 'Anyone';

  if (policy === 'Anyone') return { allowed: true };

  if (policy === 'Followers') {
    if (user.followsOwner) return { allowed: true };
    return { allowed: false, reason: 'Only followers can take a seat in this room.' };
  }

  if (policy === 'Elite Only') {
    if (user.isElite) return { allowed: true };
    return { allowed: false, reason: 'Only room elites can take a seat.' };
  }

  return { allowed: true };
}

export function elitesHaveSeatPriority(roomPriority: string | undefined): boolean {
  return (roomPriority?.trim().toUpperCase() ?? 'NO') === 'YES';
}

export function sortGuestRequestsByPriority<T extends { isElite?: boolean }>(
  requests: T[],
  roomPriority: string | undefined,
): T[] {
  if (!elitesHaveSeatPriority(roomPriority)) return requests;
  return [...requests].sort((a, b) => Number(b.isElite) - Number(a.isElite));
}

export function formatJoinPolicySummary(settings: {
  whoCanJoin?: string;
  whoCanBeSeated?: string;
  roomPriority?: string;
}): string {
  const parts = [
    `Join: ${settings.whoCanJoin?.trim() || 'Anyone'}`,
    `Seats: ${settings.whoCanBeSeated?.trim() || 'Anyone'}`,
  ];
  if (elitesHaveSeatPriority(settings.roomPriority)) {
    parts.push('Elites queue first');
  }
  return parts.join(' · ');
}

export function resolveUserJoinContext(
  viewer: { isFollowing?: boolean; isElite?: boolean; inOwnerCircle?: boolean } | undefined,
  options?: { defaultFollowing?: boolean; defaultElite?: boolean; defaultInOwnerCircle?: boolean },
): RoomJoinContext {
  return {
    followsOwner: viewer?.isFollowing ?? options?.defaultFollowing ?? false,
    inOwnerCircle: viewer?.inOwnerCircle ?? options?.defaultInOwnerCircle ?? false,
    isElite: viewer?.isElite ?? options?.defaultElite ?? false,
  };
}

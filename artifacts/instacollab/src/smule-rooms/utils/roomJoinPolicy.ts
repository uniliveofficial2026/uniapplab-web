export type RoomJoinContext = {
  /** Logged-in user follows the room owner */
  followsOwner: boolean;
  /** Room owner follows the logged-in user (owner's circle) */
  inOwnerCircle: boolean;
  isElite: boolean;
};

/** How guests take empty seats — independent from who is eligible. */
export type SeatJoinMode = 'free' | 'approval';

export const SEAT_JOIN_MODE_OPTIONS: SeatJoinMode[] = ['free', 'approval'];

export const WHO_CAN_BE_SEATED_OPTIONS = ['Anyone', 'Followers', 'Elite Only'] as const;

export function normalizeSeatJoinMode(value: string | null | undefined): SeatJoinMode {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (
    raw === 'approval' ||
    raw === 'request' ||
    raw === 'require request approval' ||
    raw === 'request approval' ||
    raw === 'locked'
  ) {
    return 'approval';
  }
  return 'free';
}

export function normalizeWhoCanBeSeated(value: string | null | undefined): string {
  const policy = String(value || '').trim() || 'Anyone';
  if (policy === 'Followers' || policy === 'Elite Only' || policy === 'Anyone') {
    return policy;
  }
  if (
    policy.toLowerCase() === 'approval' ||
    policy.toLowerCase() === 'request approval'
  ) {
    return 'Anyone';
  }
  return policy;
}

/**
 * Seat entry: free join vs request approval.
 * Prefer explicit seatJoinMode; fall back to legacy coupling on whoCanBeSeated.
 */
export function resolveSeatJoinMode(settings: {
  seatJoinMode?: string | null;
  whoCanBeSeated?: string | null;
}): SeatJoinMode {
  if (settings.seatJoinMode != null && String(settings.seatJoinMode).trim()) {
    return normalizeSeatJoinMode(settings.seatJoinMode);
  }
  // Legacy: anything other than Anyone meant "require approval".
  return (settings.whoCanBeSeated?.trim() ?? 'Anyone') !== 'Anyone' ? 'approval' : 'free';
}

/**
 * Accepts either full settings or the legacy whoCanBeSeated string.
 */
export function seatJoinRequiresApproval(
  settings:
    | {
        seatJoinMode?: string | null;
        whoCanBeSeated?: string | null;
      }
    | string
    | undefined,
): boolean {
  if (typeof settings === 'string' || settings == null) {
    return resolveSeatJoinMode({ whoCanBeSeated: settings }) === 'approval';
  }
  return resolveSeatJoinMode(settings) === 'approval';
}

/** @deprecated Prefer seatJoinModeFromApprovalRequired. */
export function whoCanBeSeatedFromApprovalRequired(requiresApproval: boolean): string {
  return requiresApproval ? 'Followers' : 'Anyone';
}

export function seatJoinModeFromApprovalRequired(requiresApproval: boolean): SeatJoinMode {
  return requiresApproval ? 'approval' : 'free';
}

export function formatSeatJoinModeLabel(mode: SeatJoinMode | string): string {
  return normalizeSeatJoinMode(mode) === 'approval'
    ? 'Require Request Approval'
    : 'Freely Join (No Request)';
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

/** Eligibility only — does not encode free vs approval. */
export function canUserTakeSeat(
  whoCanBeSeated: string | undefined,
  user: RoomJoinContext,
): { allowed: boolean; reason?: string } {
  const policy = normalizeWhoCanBeSeated(whoCanBeSeated);

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
  seatJoinMode?: string;
  roomPriority?: string;
}): string {
  const seatMode = resolveSeatJoinMode(settings);
  const parts = [
    `Join: ${settings.whoCanJoin?.trim() || 'Anyone'}`,
    `Seats: ${normalizeWhoCanBeSeated(settings.whoCanBeSeated)}`,
    `Entry: ${seatMode === 'approval' ? 'Approval' : 'Free'}`,
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

export function mergeGuestSeatRequests<
  T extends { id: string; userId?: string; name: string; avatar: string; isElite?: boolean },
>(
  local: T[],
  remote: T[] | undefined,
  opts: { senderId: string; ownerUserId: string },
): T[] {
  if (!remote) return local;
  const isOwnerBroadcast =
    Boolean(opts.senderId) &&
    Boolean(opts.ownerUserId) &&
    opts.senderId === opts.ownerUserId;
  if (isOwnerBroadcast) {
    return remote;
  }
  const byId = new Map(local.map((row) => [row.id, row]));
  for (const row of remote) {
    if (!row?.id) continue;
    if (row.userId && row.userId !== opts.senderId) continue;
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

import type { User } from '../../types';

export type UserDecorationInput = {
  userId: string;
  roomId?: string;
  user?: User | null;
  entitlements?: Record<string, unknown>;
  liveSession?: { host_user_id?: string | null } | null;
  seats?: Array<{ user_id?: string | null; seat_index?: number }> | null;
};

export type UserDecorations = {
  userId: string;
  vipTier: 'none' | 'vip' | 'svip';
  avatarFrame: string | null;
  profileFrame: string | null;
  commentFrame: string | null;
  isAdmin: boolean;
  isHost: boolean;
  isCoinSeller: boolean;
  isGuestSeat: boolean;
};

function readEntitlement(
  entitlements: Record<string, unknown> | undefined,
  userId: string,
  type: string,
): unknown {
  const bucket = entitlements?.[userId];
  if (!bucket || typeof bucket !== 'object') return null;
  return (bucket as Record<string, unknown>)[type] ?? null;
}

/** Resolve presentation decorations strictly by target user_id — never by list index or stale shared object. */
export function resolveUserDecorations(input: UserDecorationInput): UserDecorations {
  const { userId, user, entitlements, liveSession, seats, roomId } = input;
  const vipRaw = readEntitlement(entitlements, userId, 'vip');
  const svipRaw = readEntitlement(entitlements, userId, 'svip');
  const vipTier: UserDecorations['vipTier'] = svipRaw ? 'svip' : vipRaw ? 'vip' : 'none';

  const avatarFrame = (readEntitlement(entitlements, userId, 'avatar_frame') as string | null) ?? null;
  const profileFrame = (readEntitlement(entitlements, userId, 'profile_frame') as string | null) ?? null;
  const commentFrame =
    (readEntitlement(entitlements, userId, 'comment_frame') as string | null) ?? null;

  const role = String(user?.role ?? '').toLowerCase();
  const isAdmin = role === 'admin';
  const isHost = Boolean(liveSession?.host_user_id && liveSession.host_user_id === userId);
  const isGuestSeat = Boolean(
    roomId &&
      Array.isArray(seats) &&
      seats.some((seat) => seat.user_id === userId),
  );
  const isCoinSeller = Boolean(readEntitlement(entitlements, userId, 'coin_seller'));

  return {
    userId,
    vipTier,
    avatarFrame,
    profileFrame,
    commentFrame,
    isAdmin,
    isHost,
    isCoinSeller,
    isGuestSeat,
  };
}

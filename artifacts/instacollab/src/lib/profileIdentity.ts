import { db } from './db/localDb';
import { safeUsername } from './safe';
import {
  isSimulatedRoomUserId,
  lookupUserIdByDisplayName,
} from '../smule-rooms/utils/roomUserLookup';

const PENDING_APP_PROFILE_USER_ID_KEY = 'pendingAppProfileUserId';

export function setPendingAppProfileUserId(userId: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  if (userId) {
    sessionStorage.setItem(PENDING_APP_PROFILE_USER_ID_KEY, userId);
  } else {
    sessionStorage.removeItem(PENDING_APP_PROFILE_USER_ID_KEY);
  }
}

export function consumePendingAppProfileUserId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const userId = sessionStorage.getItem(PENDING_APP_PROFILE_USER_ID_KEY);
  sessionStorage.removeItem(PENDING_APP_PROFILE_USER_ID_KEY);
  return userId?.trim() || null;
}

/** Map a room/karaoke viewer id or labels to a canonical app user id when possible. */
export function resolveCanonicalAppUserId(
  userId: string | null | undefined,
  displayName?: string | null,
  username?: string | null,
): string | null {
  const id = userId?.trim();
  if (id && !isSimulatedRoomUserId(id) && db.users.some((user) => user.id === id)) {
    return id;
  }

  const fromName = lookupUserIdByDisplayName(displayName);
  if (fromName) return fromName;

  const normalizedUsername = username?.trim();
  if (normalizedUsername) {
    const needle = safeUsername(normalizedUsername.replace(/^@/, ''));
    const match = db.users.find(
      (user) => safeUsername(user.username) === needle,
    );
    if (match?.id) return match.id;
  }

  if (id && !isSimulatedRoomUserId(id)) return id;
  return null;
}

export function canOpenKnownAppProfile(options: {
  userId?: string | null;
  displayName?: string | null;
  username?: string | null;
  isSelf?: boolean;
}): boolean {
  if (options.isSelf) return true;
  return Boolean(
    resolveCanonicalAppUserId(
      options.userId,
      options.displayName,
      options.username,
    ),
  );
}

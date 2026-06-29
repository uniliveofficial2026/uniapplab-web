import { db } from '../../lib/db/localDb';
import { DEMO_ROOM_IDS, DEMO_ROOM_OWNER_USER_IDS } from './roomDemoConstants';
import { getRoomSettings } from './storage';

function normalizeJoinPolicy(policy: string | undefined): string {
  const trimmed = policy?.trim() ?? 'Anyone';
  if (trimmed === "Room Owner's Following") return 'OwnerCircle';
  if (trimmed === 'Following') return 'Following';
  return trimmed;
}

/**
 * Dev seed: ensure the logged-in user can pass demo room join/seat policies.
 * Only adds missing edges — never removes user-initiated unfollows.
 */
export function seedDemoRoomFollowGraph(roomId: string): void {
  const ownerId = DEMO_ROOM_OWNER_USER_IDS[roomId];
  if (!ownerId) return;

  const meId = db.currentUserId?.trim();
  if (!meId || meId === ownerId) return;

  const settings = getRoomSettings(roomId);
  const joinPolicy = normalizeJoinPolicy(settings.whoCanJoin);
  const seatPolicy = settings.whoCanBeSeated?.trim() ?? 'Anyone';

  if (joinPolicy === 'OwnerCircle' && !db.getFollowingIds(ownerId).includes(meId)) {
    db.ensureUserFollows(ownerId, meId);
  }

  const needsFollowOwner =
    joinPolicy === 'Following' ||
    seatPolicy === 'Followers';

  if (needsFollowOwner && !db.isFollowingUser(ownerId)) {
    db.ensureUserFollows(meId, ownerId);
  }
}

export function seedAllDemoRoomFollowGraphs(): void {
  for (const roomId of DEMO_ROOM_IDS) {
    seedDemoRoomFollowGraph(roomId);
  }
}

import { db } from '../../lib/db/localDb';
import { findUserById } from '../../lib/safe';
import {
  formatProfileHandle,
  getProfileDisplayName,
  getProfileMentionLabel,
  shouldShowProfileHandle,
} from '../../lib/profileDisplay';
import { listKaraokeCoverRecordingsForUser } from '../../lib/karaokeRecordings';
import { getKaraokeProfileBackground } from '../../lib/karaokeProfileBackground';
import type { KaraokeProfileBackgroundMediaKind, KaraokeProfileBackgroundFocus } from '../../lib/karaokeProfileBackground';
import type { RoomViewerEntry } from './roomViewers';
import { isSimulatedRoomUserId, lookupUserIdByDisplayName } from './roomUserLookup';
import {
  resolveCoOwnerUserId,
  resolveOwnerUserId,
  resolveRoleMemberEntries,
} from './roomRoleUsers';
import { resolveRoomMemberIdentity } from './roomMemberProfile';
import type { RoomSettings } from './storage';
import { isRoomSelfGuest, type RoomSelfIdentity } from './selfIdentity';

export type RoomProfilePreview = {
  id: string;
  resolvedUserId: string | null;
  isSelf: boolean;
  displayName: string;
  handle: string;
  mentionLabel: string;
  showHandle: boolean;
  avatar: string;
  isFollowing: boolean;
  isAdmin: boolean;
  isCoOwner: boolean;
  isOwner: boolean;
  followers: number;
  following: number;
  recordings: number;
  level: number;
  bio: string;
  backgroundUrl?: string | null;
  backgroundMediaId?: string | null;
  backgroundMimeType?: string;
  backgroundMediaKind?: KaraokeProfileBackgroundMediaKind;
  backgroundFocus?: KaraokeProfileBackgroundFocus | null;
};

function normalizeViewerNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Resolve a party-room viewer to a canonical app user id when one exists. */
export function resolveRoomViewerUserId(
  viewer: Pick<RoomViewerEntry, 'id' | 'name' | 'isOwner' | 'isCoOwner' | 'isAdmin'>,
  settings: RoomSettings,
): string | null {
  const rawId = viewer.id?.trim();

  if (viewer.isOwner) {
    const ownerId = resolveOwnerUserId(settings);
    if (ownerId && !isSimulatedRoomUserId(ownerId)) return ownerId;
  }

  if (viewer.isCoOwner) {
    const coOwnerId = resolveCoOwnerUserId(settings);
    if (coOwnerId && !isSimulatedRoomUserId(coOwnerId)) return coOwnerId;
  }

  if (viewer.isAdmin) {
    const adminMembers = resolveRoleMemberEntries(settings, 'admin');
    const matchedAdmin = adminMembers.find(
      (member) =>
        (member.userId && member.userId === rawId) ||
        normalizeViewerNameKey(member.name) === normalizeViewerNameKey(viewer.name),
    );
    if (matchedAdmin?.userId && !isSimulatedRoomUserId(matchedAdmin.userId)) {
      return matchedAdmin.userId;
    }
  }

  if (rawId && !isSimulatedRoomUserId(rawId) && db.users.some((user) => user.id === rawId)) {
    return rawId;
  }

  const fromName = lookupUserIdByDisplayName(viewer.name);
  if (fromName && !isSimulatedRoomUserId(fromName)) return fromName;

  if (rawId && !isSimulatedRoomUserId(rawId)) return rawId;
  return null;
}

/** Live profile card data for party-room viewer preview — db-backed, no mock hashes. */
export function buildRoomProfilePreview(
  viewer: RoomViewerEntry,
  settings: RoomSettings,
  self: RoomSelfIdentity,
): RoomProfilePreview {
  const resolvedUserId = resolveRoomViewerUserId(viewer, settings);
  const isSelf =
    resolvedUserId === self.id ||
    viewer.id === self.id ||
    isRoomSelfGuest({ userId: viewer.id, name: viewer.name }, self);
  const user = resolvedUserId ? findUserById(db.users, resolvedUserId) : null;
  const isKnownUser = Boolean(resolvedUserId && user && user.id !== 'unknown');
  const identity = resolveRoomMemberIdentity(
    resolvedUserId ?? viewer.id,
    viewer.name,
    settings.roomId,
  );

  const displayName = isKnownUser
    ? getProfileDisplayName(user!, viewer.name)
    : identity.name;
  const handle = isKnownUser ? formatProfileHandle(user!) : '';
  const showHandle = isKnownUser ? shouldShowProfileHandle(user!) : false;
  const mentionLabel = isKnownUser
    ? getProfileMentionLabel(user!, viewer.name)
    : viewer.name.replace(/^@/, '');

  let followers = 0;
  let following = 0;
  let recordings = 0;
  let level = 1;
  let bio = '';
  let isFollowing = viewer.isFollowing ?? false;
  let backgroundUrl: string | null = null;
  let backgroundMediaId: string | null = null;
  let backgroundMimeType: string | undefined;
  let backgroundMediaKind: KaraokeProfileBackgroundMediaKind | undefined;
  let backgroundFocus: KaraokeProfileBackgroundFocus | null = null;

  if (isKnownUser && resolvedUserId) {
    followers = db.getFollowListMembers(resolvedUserId, 'followers').length;
    following = db.getFollowListMembers(resolvedUserId, 'following').length;
    recordings = listKaraokeCoverRecordingsForUser(resolvedUserId).length;
    level = db.getCreatorProgress(resolvedUserId).level;
    bio = user!.bio?.trim() || '';
    const background = getKaraokeProfileBackground(resolvedUserId);
    backgroundUrl = background?.url ?? null;
    backgroundMediaId = background?.mediaId ?? null;
    backgroundMimeType = background?.mimeType;
    backgroundMediaKind = background?.mediaKind;
    backgroundFocus = background?.focus ?? null;
    if (resolvedUserId !== self.id) {
      isFollowing = db.isFollowingUser(resolvedUserId);
    }
  }

  return {
    id: viewer.id,
    resolvedUserId,
    isSelf,
    displayName,
    handle,
    mentionLabel,
    showHandle,
    avatar: isKnownUser ? identity.avatarUrl : identity.avatarUrl || viewer.avatar,
    isFollowing,
    isAdmin: viewer.isAdmin ?? false,
    isCoOwner: viewer.isCoOwner ?? false,
    isOwner: viewer.isOwner ?? false,
    followers,
    following,
    recordings,
    level,
    bio,
    backgroundUrl,
    backgroundMediaId,
    backgroundMimeType,
    backgroundMediaKind,
    backgroundFocus,
  };
}

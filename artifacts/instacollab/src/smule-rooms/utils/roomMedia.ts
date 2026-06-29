/** Shared member / cover avatar resolution for smule room pages. */

import { formatRoomBackgroundLabel } from './roomBackground';

const UNSPLASH_PORTRAITS = [
  'photo-1544005313-94ddf0286df2',
  'photo-1494790108377-be9c29b29330',
  'photo-1517841905240-472988babdf9',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1524504388940-b1c1722653e1',
  'photo-1500648767791-00dcc994a43e',
  'photo-1519085360753-af0119f7cbe7',
  'photo-1488161628813-04466f872be2',
  'photo-1534528741775-53994a69daeb',
  'photo-1506794778202-cad84cf45f1d',
  'photo-1438761681033-6461ffad8d80',
  'photo-1531427186611-ecfd6d936c79',
] as const;

const UNSPLASH_COVERS = [
  'photo-1514525253161-7a46d19cd819',
  'photo-1470225620780-dba8ba36b745',
  'photo-1493225457124-a3eb161ffa5f',
  'photo-1511671782779-c97d3d27a1d4',
  'photo-1516450360452-9312f5e86fc7',
] as const;

const ROOM_MEMBER_AVATARS_PREFIX = 'roomMemberAvatars:';
const ROOM_COVER_PREFIX = 'roomCoverPhoto:';

/** Static demo aliases → same Unsplash pool used in Room.tsx seats. */
const KNOWN_MEMBER_AVATARS: Record<string, string> = {
  soulsister: portraitUrl(0),
  owner: portraitUrl(1),
  'co-owner': portraitUrl(8),
  'admin 1': portraitUrl(2),
  'admin 2': portraitUrl(3),
  'singer 1': portraitUrl(4),
  'singer 2': portraitUrl(5),
  helenal: portraitUrl(1),
  'vip_sanny': portraitUrl(0),
  'vip sanny': portraitUrl(0),
  sanny: portraitUrl(0),
  'dj mike': portraitUrl(8),
};

const DEMO_ROOM_COVERS: Record<string, string> = {
  '1181033': coverUrl(2),
  '1167298': coverUrl(0),
};

export function isPlaceholderSetting(value: string | undefined | null): boolean {
  const trimmed = value?.trim() ?? '';
  return !trimmed || trimmed === 'Edit' || trimmed === 'Default';
}

export function displaySettingValue(
  value: string | undefined | null,
  fallback: string,
): string {
  return isPlaceholderSetting(value) ? fallback : value!.trim();
}

/** Truncated label for edit rows — never shows Smule "Edit" placeholder. */
export function formatSettingPreview(
  value: string | undefined | null,
  fallback = 'Not set',
  maxLength = 36,
): string {
  const text = displaySettingValue(value, fallback);
  if (text === fallback) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function formatBackgroundLabel(value: string | undefined | null): string {
  return formatRoomBackgroundLabel(value);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalizeMemberKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function portraitUrl(index: number, size = 120): string {
  const photo = UNSPLASH_PORTRAITS[index % UNSPLASH_PORTRAITS.length];
  return `https://images.unsplash.com/${photo}?w=${size}&h=${size}&fit=crop&crop=faces`;
}

function coverUrl(index: number, size = 168): string {
  const photo = UNSPLASH_COVERS[index % UNSPLASH_COVERS.length];
  return `https://images.unsplash.com/${photo}?w=${size}&h=${size}&fit=crop`;
}

function deterministicPortrait(name: string, size = 120): string {
  const idx = hashString(normalizeMemberKey(name));
  return portraitUrl(idx, size);
}

function deterministicCover(seed: string, size = 168): string {
  const idx = hashString(seed.toLowerCase());
  return coverUrl(idx, size);
}

function readRoomMemberAvatars(roomId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`${ROOM_MEMBER_AVATARS_PREFIX}${roomId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeRoomMemberAvatars(roomId: string, map: Record<string, string>): void {
  localStorage.setItem(`${ROOM_MEMBER_AVATARS_PREFIX}${roomId}`, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('room-member-avatars-updated', { detail: { roomId } }));
}

/** Merge live seat / viewer avatars so Room Details stays in sync with the party room. */
export function syncRoomMemberAvatars(
  roomId: string,
  members: Array<{ name: string; avatar: string }>,
): void {
  if (!roomId || members.length === 0) return;
  const current = readRoomMemberAvatars(roomId);
  let changed = false;

  for (const member of members) {
    const name = member.name?.trim();
    const avatar = member.avatar?.trim();
    if (!name || !avatar || !avatar.startsWith('http')) continue;
    const key = normalizeMemberKey(name);
    if (current[key] !== avatar) {
      current[key] = avatar;
      changed = true;
    }
  }

  if (changed) {
    writeRoomMemberAvatars(roomId, current);
  }
}

export function setRoomCoverPhoto(roomId: string, url: string): void {
  if (!roomId || !url.startsWith('http')) return;
  localStorage.setItem(`${ROOM_COVER_PREFIX}${roomId}`, url);
  window.dispatchEvent(new CustomEvent('room-cover-updated', { detail: { roomId } }));
}

function readStoredRoomCover(roomId: string): string | null {
  return localStorage.getItem(`${ROOM_COVER_PREFIX}${roomId}`);
}

export function resolveRoomCoverUrl(
  coverPhoto: string | undefined,
  roomId: string,
  roomName?: string,
): string {
  if (
    coverPhoto &&
    !isPlaceholderSetting(coverPhoto) &&
    (coverPhoto.startsWith('http') || coverPhoto.startsWith('data:'))
  ) {
    return coverPhoto;
  }

  const stored = readStoredRoomCover(roomId);
  if (stored) return stored;

  if (DEMO_ROOM_COVERS[roomId]) return DEMO_ROOM_COVERS[roomId];

  return deterministicCover(roomName?.trim() || roomId, 168);
}

export function resolveMemberAvatarUrl(name: string, roomId?: string, size = 120): string {
  const trimmed = name.trim();
  if (!trimmed) return portraitUrl(0, size);

  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const normalized = normalizeMemberKey(trimmed);

  if (roomId) {
    const roomAvatars = readRoomMemberAvatars(roomId);
    const fromRoom = roomAvatars[normalized];
    if (fromRoom) return fromRoom;
  }

  const known = KNOWN_MEMBER_AVATARS[normalized];
  if (known) return known.replace(/w=\d+&h=\d+/, `w=${size}&h=${size}`);

  return deterministicPortrait(trimmed, size);
}

/** Split comma-separated admin / singer lists from room settings. */
export function parseMemberList(value: string | undefined | null): string[] {
  if (isPlaceholderSetting(value)) return [];
  return value!
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Seed demo room covers + member avatars once per room. */
export function seedDemoRoomMedia(roomId: string, members: Array<{ name: string; avatar: string }>): void {
  if (!readStoredRoomCover(roomId) && DEMO_ROOM_COVERS[roomId]) {
    localStorage.setItem(`${ROOM_COVER_PREFIX}${roomId}`, DEMO_ROOM_COVERS[roomId]);
  }
  syncRoomMemberAvatars(roomId, members);
}

/** Idempotent demo media for rooms shown in managed list before first party visit. */
export function ensureDemoRoomMediaRegistry(): void {
  seedDemoRoomMedia('1167298', [
    { name: 'SoulSister', avatar: portraitUrl(0) },
    { name: 'Admin 1', avatar: portraitUrl(2) },
    { name: 'Admin 2', avatar: portraitUrl(3) },
    { name: 'Singer 1', avatar: portraitUrl(4) },
    { name: 'Singer 2', avatar: portraitUrl(5) },
    { name: 'Co-owner', avatar: portraitUrl(8) },
  ]);
  seedDemoRoomMedia('1181033', [
    { name: 'VIP_Sanny', avatar: portraitUrl(0) },
    { name: 'Owner', avatar: portraitUrl(1) },
  ]);
}

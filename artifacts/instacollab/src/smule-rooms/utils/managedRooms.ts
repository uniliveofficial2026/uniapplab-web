import { getAppUserId } from '../../lib/appUserId';
import { formatRoomRoleLabel, normalizeRoomRole, type RoomMemberRole } from './roles';
import { getRoomSettings, saveRoomSettings, ensureRoomSettingsSeeded, type RoomMode } from './storage';
import { ensureRoomRoleUserIds, resolveEffectiveMemberRole, ensureDemoRoomFollowAccess } from './roomRoleUsers';
import { initRoomExp } from './roomExp';
import { initRoomGifts } from './roomGifts';
import { seedDemoRoomMedia, ensureDemoRoomMediaRegistry } from './roomMedia';

export type ManagedRoomRole = Exclude<RoomMemberRole, 'user'>;

export interface ManagedRoom {
  id: string;
  name: string;
  roomMode: RoomMode;
  role: ManagedRoomRole;
  hostName?: string;
  level?: number;
  grantedAt: number;
  updatedAt: number;
}

const STORAGE_PREFIX = 'managedPartyRooms';

const DEMO_GRANTS: Omit<ManagedRoom, 'grantedAt' | 'updatedAt'>[] = [
  {
    id: '1181033',
    name: 'BRASIL',
    roomMode: 'Chat',
    role: 'co-owner',
    hostName: 'VIP_Sanny',
    level: 4,
  },
  {
    id: '1167298',
    name: '90s R&B Throwbacks',
    roomMode: 'Chat',
    role: 'admin',
    hostName: 'SoulSister',
    level: 3,
  },
];

function getManagedRoomsStorageKey(): string {
  return `${STORAGE_PREFIX}:${getAppUserId()}`;
}

function normalizeManagedRoomRole(role: string): ManagedRoomRole {
  const normalized = normalizeRoomRole(role);
  if (normalized === 'owner' || normalized === 'co-owner' || normalized === 'admin') {
    return normalized;
  }
  return 'admin';
}

function readManagedRooms(): ManagedRoom[] {
  try {
    const raw = localStorage.getItem(getManagedRoomsStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ManagedRoom[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((room) => ({
      ...room,
      role: normalizeManagedRoomRole(room.role),
    }));
  } catch {
    return [];
  }
}

function writeManagedRooms(rooms: ManagedRoom[]) {
  localStorage.setItem(getManagedRoomsStorageKey(), JSON.stringify(rooms));
  window.dispatchEvent(new CustomEvent('managed-rooms-updated'));
}

function mergeDemoGrantsInMemory(existing: ManagedRoom[]): ManagedRoom[] {
  const now = Date.now();
  const merged = [...existing];
  for (const grant of DEMO_GRANTS) {
    if (merged.some((room) => room.id === grant.id)) continue;
    merged.push({
      ...grant,
      grantedAt: now,
      updatedAt: now,
    });
  }
  return merged;
}

function seedDemoGrants(existing: ManagedRoom[]): ManagedRoom[] {
  const now = Date.now();
  const merged = [...existing];
  for (const grant of DEMO_GRANTS) {
    if (merged.some((room) => room.id === grant.id)) continue;
    merged.push({
      ...grant,
      grantedAt: now,
      updatedAt: now,
    });
    ensureRoomSettingsSeeded(grant.id, {
      roomId: grant.id,
      roomName: grant.name,
      roomMode: grant.roomMode,
      owner: grant.hostName,
    });
    if (grant.id === '1167298') {
      seedDemoRoomMedia(grant.id, [
        { name: 'SoulSister', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=faces' },
        { name: 'Admin 1', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=faces' },
        { name: 'Admin 2', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces' },
        { name: 'Singer 1', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&h=120&fit=crop&crop=faces' },
        { name: 'Singer 2', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces' },
        { name: 'Co-owner', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces' },
      ]);
    }
  }
  return merged;
}

/** Persist demo grants + room settings — call from effects, not during render. */
export function ensureManagedRoomsHydrated(): void {
  ensureDemoRoomMediaRegistry();
  const rooms = readManagedRooms();
  const seeded = seedDemoGrants(rooms);
  if (seeded.length !== rooms.length) {
    writeManagedRooms(seeded);
  }
}

export function getManagedRooms(): ManagedRoom[] {
  const rooms = mergeDemoGrantsInMemory(readManagedRooms());
  return rooms.sort((a, b) => {
    const roleOrder = roleSortWeight(a.role) - roleSortWeight(b.role);
    if (roleOrder !== 0) return roleOrder;
    return b.updatedAt - a.updatedAt;
  });
}

function roleSortWeight(role: ManagedRoomRole): number {
  switch (role) {
    case 'owner':
      return 0;
    case 'co-owner':
      return 1;
    case 'admin':
      return 2;
    default:
      return 3;
  }
}

export function getManagedRoomById(roomId: string): ManagedRoom | undefined {
  return getManagedRooms().find((room) => room.id === roomId);
}

export function upsertManagedRoom(
  entry: Omit<ManagedRoom, 'grantedAt' | 'updatedAt'> & { grantedAt?: number; updatedAt?: number }
): ManagedRoom {
  const now = Date.now();
  const rooms = readManagedRooms();
  const existing = rooms.find((room) => room.id === entry.id);
  const next: ManagedRoom = {
    id: entry.id,
    name: entry.name,
    roomMode: entry.roomMode,
    role: normalizeManagedRoomRole(entry.role),
    hostName: entry.hostName,
    level: entry.level,
    grantedAt: existing?.grantedAt ?? entry.grantedAt ?? now,
    updatedAt: entry.updatedAt ?? now,
  };
  writeManagedRooms([next, ...rooms.filter((room) => room.id !== entry.id)]);
  return next;
}

export function removeManagedRoom(roomId: string): void {
  writeManagedRooms(readManagedRooms().filter((room) => room.id !== roomId));
}

export const ROOM_MODE_OPTIONS = [
  'Chat',
  'Party',
  'Karaoke',
  'Radio',
  'Multi-Guest',
] as const;

export type RoomModePickerOption = (typeof ROOM_MODE_OPTIONS)[number];

/** Short helper copy shown under each layout in the room-mode picker. */
export const ROOM_MODE_DESCRIPTIONS: Record<RoomModePickerOption, string> = {
  Chat: 'Chat-first · lighter audience layout',
  Party: 'Full party stage · 8 guest seats · sing & chat',
  Karaoke: 'Chorus stage · 12 seats (2 rows × 6) · song queue & duets',
  Radio: 'Watch Together · 9 seats · shared video or audio',
  'Multi-Guest': 'Large party stage · 9 guest seats',
};

export function formatRoomModeLabel(mode: RoomMode | string): string {
  switch (mode) {
    case 'Karaoke':
      return 'Karaoke';
    case 'Party':
      return 'Party';
    case 'Radio':
      return 'Watch Together';
    case 'Multi-Guest':
      return 'Multi-Guest';
    case 'Chat':
      return 'Chat Lounge';
    default:
      return 'Chat Lounge';
  }
}

export function formatManagedRoomRoleLabel(role: ManagedRoomRole): string {
  return formatRoomRoleLabel(role);
}

/** Load room settings + role before navigating into a managed room. */
export function clearActiveRoomSession(roomId?: string): void {
  if (typeof localStorage === 'undefined') return;
  const activeRoomId = localStorage.getItem('activeRoomId');
  if (!roomId || activeRoomId === roomId || !activeRoomId) {
    localStorage.removeItem('activeRoomId');
  }
}

export function activateRoomContext(
  room: Pick<ManagedRoom, 'id' | 'name' | 'roomMode' | 'role'> & { hostName?: string },
): void {
  const existing = getRoomSettings(room.id);
  saveRoomSettings(room.id, {
    ...existing,
    roomId: room.id,
    roomName: room.name,
    roomMode: room.roomMode,
  });
  ensureRoomSettingsSeeded(room.id, {
    roomId: room.id,
    roomName: room.name,
    roomMode: room.roomMode,
    owner: room.hostName,
  });
  const settings = ensureRoomRoleUserIds(room.id);
  ensureDemoRoomFollowAccess(room.id);
  const appUserId = getAppUserId();
  const effectiveRole = resolveEffectiveMemberRole(settings, appUserId, {
    sessionRole: normalizeManagedRoomRole(room.role),
    sessionUserId: appUserId,
  });
  localStorage.setItem('currentUserRole', effectiveRole);
  localStorage.setItem('activeRoomId', room.id);
  initRoomExp(room.id);
  initRoomGifts(room.id);
}

export function syncManagedRoomFromActiveSession(
  roomId: string,
  role: ManagedRoomRole,
  overrides?: Partial<Pick<ManagedRoom, 'name' | 'roomMode' | 'hostName' | 'level'>>
): void {
  const settings = getRoomSettings(roomId);
  upsertManagedRoom({
    id: roomId,
    name: overrides?.name ?? (settings.roomName?.trim() || `Room ${roomId}`),
    roomMode: (overrides?.roomMode ?? settings.roomMode ?? 'Chat') as RoomMode,
    role,
    hostName: overrides?.hostName,
    level: overrides?.level,
  });
}

export function groupManagedRoomsByRole(rooms: ManagedRoom[]): Record<ManagedRoomRole, ManagedRoom[]> {
  const groups: Record<ManagedRoomRole, ManagedRoom[]> = {
    owner: [],
    'co-owner': [],
    admin: [],
  };
  for (const room of rooms) {
    groups[room.role].push(room);
  }
  return groups;
}

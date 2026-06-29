/** Roles that may edit room settings (details pencil, edit page, background, etc.) */
export const ROOM_EDITOR_ROLES = ['owner', 'admin', 'co-owner'] as const;

export type RoomEditorRole = (typeof ROOM_EDITOR_ROLES)[number];

export type RoomMemberRole = 'owner' | 'co-owner' | 'admin' | 'user';

/** Host and owner are the same privilege level; legacy data may still say "host". */
export function normalizeRoomRole(role: string): RoomMemberRole {
  const normalized = role.toLowerCase();
  if (normalized === 'host' || normalized === 'owner') return 'owner';
  if (normalized === 'co-owner') return 'co-owner';
  if (normalized === 'admin') return 'admin';
  return 'user';
}

export function getStoredUserRole(): string {
  return normalizeRoomRole(localStorage.getItem('currentUserRole') || 'guest');
}

export function isRoomEditorRole(role: string): role is RoomEditorRole {
  return ROOM_EDITOR_ROLES.includes(normalizeRoomRole(role) as RoomEditorRole);
}

export function isRoomOwner(role: string): boolean {
  return normalizeRoomRole(role) === 'owner';
}

export function isRoomAdminOrOwner(role: string): boolean {
  const normalized = normalizeRoomRole(role);
  return normalized === 'owner' || normalized === 'admin';
}

export function isRoomCoOwner(role: string): boolean {
  return normalizeRoomRole(role) === 'co-owner';
}

export function isRoomAdmin(role: string): boolean {
  return normalizeRoomRole(role) === 'admin';
}

/** Owner (includes host), co-owner, and admin may edit room settings. */
export function canEditRoom(role?: string): boolean {
  return isRoomEditorRole((role ?? getStoredUserRole()).toLowerCase());
}

/** Same privilege set as canEditRoom — background, bulletin, room mode, etc. */
export function canChangeRoomBackground(role?: string): boolean {
  return canEditRoom(role);
}

export function formatRoomRoleLabel(role: string): string {
  switch (normalizeRoomRole(role)) {
    case 'owner':
      return 'Owner';
    case 'co-owner':
      return 'Co-owner';
    case 'admin':
      return 'Admin';
    default:
      return 'Viewer';
  }
}

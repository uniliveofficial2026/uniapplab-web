export type TeamPkRosterMember = {
  userId: string;
  name: string;
  avatarUrl?: string;
};

function normalizeRoomId(roomId: string | null | undefined): string {
  return String(roomId ?? '').trim();
}

function normalizeRoster(members: TeamPkRosterMember[], maxMembers = 6): TeamPkRosterMember[] {
  const seen = new Set<string>();
  const result: TeamPkRosterMember[] = [];
  for (const member of members) {
    const userId = member.userId?.trim();
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    result.push({
      userId,
      name: member.name?.trim() || 'Host',
      avatarUrl: member.avatarUrl?.trim() || undefined,
    });
    if (result.length >= Math.max(1, maxMembers)) break;
  }
  return result;
}

const seatedByRoom = new Map<string, TeamPkRosterMember[]>();
const invitedByRoom = new Map<string, TeamPkRosterMember[]>();
const rosters = new Map<string, TeamPkRosterMember[]>();

function recompute(roomId: string): void {
  const seated = seatedByRoom.get(roomId) ?? [];
  const invited = invitedByRoom.get(roomId) ?? [];
  rosters.set(roomId, normalizeRoster([...seated, ...invited], 6));
}

/** Seated Solo Live guests + host. Does not wipe independently invited Team PK members. */
export function setTeamPkRoomRoster(roomId: string, members: TeamPkRosterMember[]): void {
  const key = normalizeRoomId(roomId);
  if (!key) return;
  seatedByRoom.set(key, normalizeRoster(members, 6));
  recompute(key);
}

/** Team PK roster members beyond Solo Live guest seats (captain + up to 5 teammates). */
export function setTeamPkInvitedMembers(roomId: string, members: TeamPkRosterMember[]): void {
  const key = normalizeRoomId(roomId);
  if (!key) return;
  invitedByRoom.set(key, normalizeRoster(members, 6));
  recompute(key);
}

export function clearTeamPkRoomRoster(roomId: string): void {
  const key = normalizeRoomId(roomId);
  if (!key) return;
  seatedByRoom.delete(key);
  invitedByRoom.delete(key);
  rosters.delete(key);
}

export function getTeamPkRoomRoster(roomId: string): TeamPkRosterMember[] {
  const key = normalizeRoomId(roomId);
  if (!key) return [];
  return rosters.get(key)?.map((member) => ({ ...member })) ?? [];
}

export function getTeamPkRoomUserIds(roomId: string, captainUserId?: string, maxMembers: 2 | 3 | 4 | 6 = 6): string[] {
  const captain = captainUserId?.trim() || '';
  const roster = getTeamPkRoomRoster(roomId);
  const ids = [captain, ...roster.map((member) => member.userId)].filter(Boolean);
  return [...new Set(ids)].slice(0, maxMembers);
}

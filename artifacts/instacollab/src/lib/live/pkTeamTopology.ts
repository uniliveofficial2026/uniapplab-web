/**
 * PK team topology helpers for 1v1 / 2v2 / 3v3 / 4v4 / 6v6.
 * Lifecycle room ids stay separate from LiveKit media ids.
 * Camera mapping remains by canonical user_id + track.attach().
 */

export type TeamPkSize = 2 | 3 | 4 | 6;
export type PkTopologyKind = '1v1' | '2v2' | '3v3' | '4v4' | '6v6';

export const VALID_TEAM_PK_SIZES: readonly TeamPkSize[] = [2, 3, 4, 6];

/** Match api-server LiveLifecycleService.normalizeTeamPkSize. */
export function normalizeTeamPkSize(value: number | null | undefined): TeamPkSize {
  const numeric = Number(value);
  if (numeric >= 6) return 6;
  if (numeric >= 4) return 4;
  if (numeric >= 3) return 3;
  return 2;
}

export function isValidTeamPkSize(value: unknown): value is TeamPkSize {
  return value === 2 || value === 3 || value === 4 || value === 6;
}

/**
 * Prefer declared challenge/session size so sparse rosters do not collapse
 * 6v6 → 4v4 when only a few cameras have joined yet.
 */
export function resolveDeclaredTeamPkSize(
  declared: number | null | undefined,
  hostLen = 0,
  opponentLen = 0,
): TeamPkSize {
  if (isValidTeamPkSize(declared)) return declared;
  return normalizeTeamPkSize(Math.max(hostLen, opponentLen, 2));
}

export function pkTopologyKindFromTeamSize(size: 1 | TeamPkSize): PkTopologyKind {
  if (size === 1) return '1v1';
  if (size === 6) return '6v6';
  if (size === 4) return '4v4';
  if (size === 3) return '3v3';
  return '2v2';
}

/** Captain-first, deduped, clamped to the declared topology size. */
export function clampPkTeamRoster(
  userIds: Array<string | null | undefined> | undefined,
  captainUserId: string,
  teamSize: TeamPkSize,
): string[] {
  const captain = captainUserId.trim();
  const seen = new Set<string>();
  const ordered = [captain, ...(userIds ?? [])]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  const result: string[] = [];
  for (const userId of ordered) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    result.push(userId);
    if (result.length >= teamSize) break;
  }
  return result;
}

/**
 * Dual-room PK: each side publishes in its own LiveKit media room.
 * maxPublishers budget is per side (fighters), not the sum of both rooms.
 */
export function pkSidePublisherBudget(teamSize: 1 | TeamPkSize): number {
  return teamSize === 1 ? 1 : teamSize;
}

export function mapUserIdToPkSide(
  userId: string,
  hostTeamUserIds: readonly string[],
  opponentTeamUserIds: readonly string[],
): 'host' | 'opponent' | null {
  const id = userId.trim();
  if (!id) return null;
  if (hostTeamUserIds.includes(id)) return 'host';
  if (opponentTeamUserIds.includes(id)) return 'opponent';
  return null;
}

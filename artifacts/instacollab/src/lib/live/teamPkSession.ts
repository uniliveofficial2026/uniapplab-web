import type { LivePkSessionSnapshot, PkMediaSurface } from '../platformApi';
import { resolvePkMediaId, resolvePkMediaSurface } from './pkLiveMediaRef';
import { clampPkTeamRoster, resolveDeclaredTeamPkSize, type TeamPkSize } from './pkTeamTopology';

export type TeamPkSessionOpen = {
  /** Canonical lifecycle room that owns the Team PK session. */
  roomId: string;
  /** Other team's lifecycle room; never silently substitute a media id. */
  opponentRoomId: string | null;
  hostUserId: string;
  opponentUserId: string | null;
  hostTeamUserIds: string[];
  opponentTeamUserIds: string[];
  teamSize: TeamPkSize;
  hostMediaId: string;
  opponentMediaId: string | null;
  hostMediaSurface: PkMediaSurface;
  opponentMediaSurface: PkMediaSurface | null;
  /** Preserve the already-publishing live room behind the PK overlay. */
  keepHostMedia?: boolean;
  /** Challenge accept already started canonical PK. */
  skipStartPk?: boolean;
};

export function teamPkSessionFromSnapshot(pk: LivePkSessionSnapshot): TeamPkSessionOpen {
  const hostMediaId = resolvePkMediaId(pk.hostMediaId, pk.roomId) || pk.roomId;
  const opponentMediaId = resolvePkMediaId(pk.opponentMediaId, pk.opponentRoomId) || null;
  const teamSize = resolveDeclaredTeamPkSize(
    pk.teamSize,
    pk.hostTeamUserIds?.length ?? 0,
    pk.opponentTeamUserIds?.length ?? 0,
  );
  const hostTeamUserIds = clampPkTeamRoster(
    pk.hostTeamUserIds?.length ? pk.hostTeamUserIds : [pk.hostUserId],
    pk.hostUserId,
    teamSize,
  );
  const opponentCaptain = pk.opponentUserId || pk.opponentTeamUserIds?.[0] || '';
  const opponentTeamUserIds = opponentCaptain
    ? clampPkTeamRoster(
        pk.opponentTeamUserIds?.length
          ? pk.opponentTeamUserIds
          : pk.opponentUserId
            ? [pk.opponentUserId]
            : [],
        opponentCaptain,
        teamSize,
      )
    : [];
  return {
    roomId: pk.roomId,
    opponentRoomId: pk.opponentRoomId,
    hostUserId: pk.hostUserId,
    opponentUserId: pk.opponentUserId,
    hostTeamUserIds,
    opponentTeamUserIds,
    teamSize,
    hostMediaId,
    opponentMediaId,
    hostMediaSurface: resolvePkMediaSurface(pk.hostMediaSurface, pk.hostMediaId || pk.roomId),
    opponentMediaSurface: opponentMediaId
      ? resolvePkMediaSurface(pk.opponentMediaSurface, pk.opponentMediaId || pk.opponentRoomId)
      : null,
    keepHostMedia: true,
    skipStartPk: true,
  };
}

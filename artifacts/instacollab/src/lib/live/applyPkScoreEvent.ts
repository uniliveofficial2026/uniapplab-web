export type PkScoreSnapshot = {
  roomId: string;
  hostUserId: string;
  opponentUserId: string | null;
  localScore: number;
  opponentScore: number;
  sequence: number;
  version: number;
};

export type PkRealtimeScoreEvent = {
  eventId: string;
  roomId: string;
  sequence: number;
  previousSequence: number;
  hostUserId: string;
  opponentUserId: string | null;
  localScore: number;
  opponentScore: number;
  version?: number;
};

export type PkScoreApplyResult =
  | { ok: true; snapshot: PkScoreSnapshot; duplicate: boolean }
  | { ok: false; reason: 'gap' | 'older-sequence' | 'stale-room'; snapshot: PkScoreSnapshot };

/**
 * Apply one authoritative PK score event.
 * Identity is host/opponent user_id only — never display name or seat order.
 * Duplicate event ids are ignored. Out-of-order sequences are ignored.
 * Sequence gaps require an authoritative snapshot reload.
 */
export function applyPkScoreEvent(
  snapshot: PkScoreSnapshot,
  event: PkRealtimeScoreEvent,
  seenEventIds: Set<string>,
): PkScoreApplyResult {
  if (event.roomId !== snapshot.roomId) {
    return { ok: false, reason: 'stale-room', snapshot };
  }
  if (seenEventIds.has(event.eventId)) {
    return { ok: true, snapshot, duplicate: true };
  }
  if (event.sequence <= snapshot.sequence) {
    seenEventIds.add(event.eventId);
    return { ok: false, reason: 'older-sequence', snapshot };
  }
  if (event.sequence !== snapshot.sequence + 1 || event.previousSequence !== snapshot.sequence) {
    return { ok: false, reason: 'gap', snapshot };
  }
  if (
    event.hostUserId !== snapshot.hostUserId ||
    (event.opponentUserId &&
      snapshot.opponentUserId &&
      event.opponentUserId !== snapshot.opponentUserId)
  ) {
    return { ok: false, reason: 'stale-room', snapshot };
  }
  seenEventIds.add(event.eventId);
  return {
    ok: true,
    duplicate: false,
    snapshot: {
      roomId: snapshot.roomId,
      hostUserId: snapshot.hostUserId,
      opponentUserId: event.opponentUserId ?? snapshot.opponentUserId,
      localScore: event.localScore,
      opponentScore: event.opponentScore,
      sequence: event.sequence,
      version: event.version ?? snapshot.version + 1,
    },
  };
}

export function pkSnapshotFromSession(input: {
  roomId: string;
  hostUserId: string;
  opponentUserId?: string | null;
  localScore?: number | null;
  opponentScore?: number | null;
  sequence?: number | null;
  version?: number | null;
}): PkScoreSnapshot {
  return {
    roomId: input.roomId,
    hostUserId: input.hostUserId,
    opponentUserId: input.opponentUserId ?? null,
    localScore: Math.max(0, Math.floor(input.localScore ?? 0)),
    opponentScore: Math.max(0, Math.floor(input.opponentScore ?? 0)),
    sequence: Math.max(0, Math.floor(input.sequence ?? 0)),
    version: Math.max(1, Math.floor(input.version ?? 1)),
  };
}

import type { LiveHostDashboardDelta, LiveHostDashboardSnapshot } from "./types";

export type DashboardApplyResult =
  | { ok: true; snapshot: LiveHostDashboardSnapshot; duplicate: boolean }
  | { ok: false; reason: "gap" | "stale-room" | "older-sequence"; snapshot: LiveHostDashboardSnapshot };

function mergePatch(
  snapshot: LiveHostDashboardSnapshot,
  patch: LiveHostDashboardDelta["patch"],
): LiveHostDashboardSnapshot {
  return {
    ...snapshot,
    ...patch,
    audience: { ...snapshot.audience, ...(patch.audience ?? {}) },
    engagement: { ...snapshot.engagement, ...(patch.engagement ?? {}) },
    participants: { ...snapshot.participants, ...(patch.participants ?? {}) },
    gifts: { ...snapshot.gifts, ...(patch.gifts ?? {}) },
    pk: { ...snapshot.pk, ...(patch.pk ?? {}) },
    media: { ...snapshot.media, ...(patch.media ?? {}) },
    sequence: snapshot.sequence,
    roomVersion: patch.roomVersion ?? snapshot.roomVersion,
  };
}

/**
 * Sequence-numbered host dashboard reducer.
 * Never blindly increments totals — only applies explicit patch values.
 */
export function applyHostDashboardDelta(
  snapshot: LiveHostDashboardSnapshot,
  delta: LiveHostDashboardDelta,
  seenEventIds: Set<string>,
): DashboardApplyResult {
  if (seenEventIds.has(delta.eventId)) {
    return { ok: true, snapshot, duplicate: true };
  }
  if (delta.roomId !== snapshot.roomId) {
    return { ok: false, reason: "stale-room", snapshot };
  }
  if (delta.sequence <= snapshot.sequence) {
    seenEventIds.add(delta.eventId);
    return { ok: false, reason: "older-sequence", snapshot };
  }
  if (delta.sequence !== snapshot.sequence + 1 || delta.previousSequence !== snapshot.sequence) {
    return { ok: false, reason: "gap", snapshot };
  }
  seenEventIds.add(delta.eventId);
  const next = mergePatch(snapshot, delta.patch);
  next.sequence = delta.sequence;
  next.generatedAt = delta.occurredAt;
  return { ok: true, snapshot: next, duplicate: false };
}

export function emptyHostDashboard(roomId: string, startedAt: string): LiveHostDashboardSnapshot {
  return {
    roomId,
    roomVersion: 1,
    sequence: 0,
    generatedAt: startedAt,
    startedAt,
    roomState: "preparing",
    audience: {
      currentConnections: 0,
      currentUniqueViewers: 0,
      peakConcurrentViewers: 0,
      uniqueViewers: 0,
      joins: 0,
      leaves: 0,
    },
    engagement: {
      comments: 0,
      commentsPerMinute: 0,
      reactions: 0,
      shares: 0,
      followersGained: 0,
    },
    participants: { connected: 0, seated: 0, pendingSeatRequests: 0 },
    gifts: {
      confirmedGiftCount: 0,
      confirmedGrossGiftValue: null,
      settlementState: "not_applicable",
    },
    pk: { state: null, localScore: null, opponentScore: null, endsAt: null },
    media: {
      connectionState: "unknown",
      connectionQuality: "unknown",
      uploadBitrate: null,
      framesPerSecond: null,
      packetLoss: null,
      roundTripTime: null,
    },
  };
}

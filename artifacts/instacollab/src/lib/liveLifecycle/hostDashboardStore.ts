import type { LiveHostDashboardDelta, LiveHostDashboardSnapshot } from '../platformApi';

export type DashboardApplyResult =
  | { ok: true; snapshot: LiveHostDashboardSnapshot; duplicate: boolean }
  | { ok: false; reason: 'gap' | 'stale-room' | 'older-sequence'; snapshot: LiveHostDashboardSnapshot };

function mergePatch(
  snapshot: LiveHostDashboardSnapshot,
  patch: LiveHostDashboardDelta['patch'],
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

/** Never blindly increment totals — only apply explicit patch values. */
export function applyHostDashboardDelta(
  snapshot: LiveHostDashboardSnapshot,
  delta: LiveHostDashboardDelta,
  seenEventIds: Set<string>,
): DashboardApplyResult {
  if (seenEventIds.has(delta.eventId)) {
    return { ok: true, snapshot, duplicate: true };
  }
  if (delta.roomId !== snapshot.roomId) {
    return { ok: false, reason: 'stale-room', snapshot };
  }
  if (delta.sequence <= snapshot.sequence) {
    seenEventIds.add(delta.eventId);
    return { ok: false, reason: 'older-sequence', snapshot };
  }
  if (delta.sequence !== snapshot.sequence + 1 || delta.previousSequence !== snapshot.sequence) {
    return { ok: false, reason: 'gap', snapshot };
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
    roomState: 'preparing',
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
      settlementState: 'not_applicable',
    },
    pk: { state: null, localScore: null, opponentScore: null, endsAt: null },
    media: {
      connectionState: 'unknown',
      connectionQuality: 'unknown',
      uploadBitrate: null,
      framesPerSecond: null,
      packetLoss: null,
      roundTripTime: null,
    },
  };
}

export function liveDurationMs(startedAt: string, nowMs = Date.now()): number {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, nowMs - start);
}

export function formatLiveDuration(startedAt: string, nowMs = Date.now()): string {
  const total = Math.floor(liveDurationMs(startedAt, nowMs) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function newLifecycleCommandId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newParticipantSessionId(userId: string): string {
  return `${userId}:${newLifecycleCommandId('ps')}`;
}

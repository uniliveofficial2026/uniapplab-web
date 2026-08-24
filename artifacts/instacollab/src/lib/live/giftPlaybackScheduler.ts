/**
 * Production gift aggregation + FIFO full-FX playback scheduler.
 *
 * Aggregation identity:
 *   roomId + recipientHostId + senderUserId + giftId + giftVariantId + comboSessionId
 *
 * Rules:
 * - Same user + same gift (active combo session) → accumulate quantity units (not event count)
 * - Different gift / different user → separate jobs
 * - maxActiveFullGiftEffects = 1 (fullscreen FX)
 * - FIFO by firstQualifyingArrivalAt (no tier jump-ahead)
 * - Combo updates while PLAYING do NOT restart the animation
 * - Combo window expires so one sender cannot hold the stage forever
 */

export const MAX_ACTIVE_FULL_GIFT_EFFECTS = 1;

/** Combo session stays open this long after the last unit for the same key. */
export const GIFT_COMBO_SESSION_MS = 2600;

/** Full FX jobs older than this are not eligible for late-joiner replay. */
export const GIFT_FULL_FX_REPLAY_TTL_MS = 12_000;

export type GiftPlaybackJobState =
  | 'QUEUED'
  | 'PREPARING'
  | 'PLAYING'
  | 'EXITING'
  | 'FINISHED'
  | 'CANCELLED';

export type GiftReplayPolicy = 'STATE' | 'ACTIVE_FX' | 'EPHEMERAL' | 'NONE';

export type GiftIncomingEvent = {
  eventId?: string | null;
  sequence?: number | null;
  occurredAt?: number | null;
  expiresAt?: number | null;
  replayPolicy?: GiftReplayPolicy | null;
  roomId: string;
  recipientHostId: string;
  senderUserId: string;
  senderName?: string;
  giftId: string;
  giftVariantId?: string | null;
  giftName?: string;
  giftIcon?: string;
  quantity: number;
  unitValue?: number;
  starValue?: number;
  effectUrl?: string | null;
  effectKind?: 'svga' | 'video' | 'lottie' | 'css' | null;
  receiverName?: string;
  /** When true, treat as barrage-only (no fullscreen stage). */
  barrageOnly?: boolean;
  /** Authoritative settlement id — required for paid FX paths. */
  giftTransactionId?: string | null;
};

export type GiftPlaybackJob = {
  playbackJobId: string;
  roomId: string;
  recipientHostId: string;
  senderUserId: string;
  senderName: string;
  giftId: string;
  variantId: string;
  giftName: string;
  giftIcon: string;
  comboSessionId: string;
  comboQuantity: number;
  totalValue: number;
  firstSequence: number;
  lastSequence: number;
  firstQualifyingArrivalAt: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  state: GiftPlaybackJobState;
  replayPolicy: GiftReplayPolicy;
  eventIds: string[];
  giftTransactionIds: string[];
  effectUrl: string | null;
  effectKind: 'svga' | 'video' | 'lottie' | 'css' | null;
  receiverName: string;
  starValue: number;
  barrageOnly: boolean;
};

export type GiftSchedulerSnapshot = {
  queued: GiftPlaybackJob[];
  active: GiftPlaybackJob | null;
  combos: Array<{
    key: string;
    comboSessionId: string;
    senderUserId: string;
    senderName: string;
    giftId: string;
    giftName: string;
    giftIcon: string;
    count: number;
    expiresAt: number;
  }>;
};

function nowMs(): number {
  return Date.now();
}

function safeQty(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 1;
  return Math.max(1, v);
}

function safeSeq(n: unknown, fallback: number): number {
  if (typeof n === 'number' && Number.isFinite(n)) return Math.floor(n);
  return fallback;
}

export function giftAggregationKey(parts: {
  roomId: string;
  recipientHostId: string;
  senderUserId: string;
  giftId: string;
  giftVariantId?: string | null;
  comboSessionId: string;
}): string {
  return [
    parts.roomId,
    parts.recipientHostId,
    parts.senderUserId,
    parts.giftId,
    parts.giftVariantId ?? 'default',
    parts.comboSessionId,
  ].join('|');
}

export function newComboSessionId(seed?: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return seed ? `${seed}:${rand}` : rand;
}

export function newPlaybackJobId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `gj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Pure aggregator+scheduler. UI mounts call ingest/advance; no React deps.
 */
export class GiftPlaybackScheduler {
  readonly maxActiveFullGiftEffects = MAX_ACTIVE_FULL_GIFT_EFFECTS;

  private jobsByKey = new Map<string, GiftPlaybackJob>();
  private fifo: string[] = [];
  private activeJobId: string | null = null;
  private seenEventIds = new Set<string>();
  private seqCounter = 0;
  /** Open combo sessions: aggregation key without session → { sessionId, expiresAt } */
  private openSessions = new Map<
    string,
    { comboSessionId: string; expiresAt: number; jobKey: string }
  >();

  private baseKey(ev: GiftIncomingEvent): string {
    return [
      ev.roomId,
      ev.recipientHostId,
      ev.senderUserId,
      ev.giftId,
      ev.giftVariantId ?? 'default',
    ].join('|');
  }

  /** Drop expired ACTIVE_FX / expired combo windows. */
  private gc(at = nowMs()): void {
    for (const [bk, sess] of [...this.openSessions.entries()]) {
      if (sess.expiresAt <= at) {
        this.openSessions.delete(bk);
        const job = this.jobsByKey.get(sess.jobKey);
        if (job && job.barrageOnly && job.state !== 'PLAYING') {
          job.state = 'FINISHED';
          job.updatedAt = at;
          this.jobsByKey.delete(sess.jobKey);
          this.fifo = this.fifo.filter((k) => k !== sess.jobKey);
        }
      }
    }
    for (const [key, job] of [...this.jobsByKey.entries()]) {
      if (job.state === 'FINISHED' || job.state === 'CANCELLED') {
        this.jobsByKey.delete(key);
        this.fifo = this.fifo.filter((k) => k !== key);
        continue;
      }
      if (
        job.replayPolicy === 'ACTIVE_FX' &&
        job.state === 'QUEUED' &&
        !job.barrageOnly &&
        job.expiresAt <= at
      ) {
        job.state = 'CANCELLED';
        job.updatedAt = at;
        this.jobsByKey.delete(key);
        this.fifo = this.fifo.filter((k) => k !== key);
      }
    }
  }

  /**
   * Ingest an authoritative gift event.
   * Returns whether a new full-FX job was created vs combo-updated.
   */
  ingest(raw: GiftIncomingEvent): {
    accepted: boolean;
    reason?: string;
    job?: GiftPlaybackJob;
    comboUpdated: boolean;
  } {
    const at = nowMs();
    this.gc(at);

    const eventId = raw.eventId?.trim() || null;
    if (eventId) {
      if (this.seenEventIds.has(eventId)) {
        return { accepted: false, reason: 'duplicate_event', comboUpdated: false };
      }
      this.seenEventIds.add(eventId);
      if (this.seenEventIds.size > 4000) {
        const drop = [...this.seenEventIds].slice(0, 1000);
        for (const id of drop) this.seenEventIds.delete(id);
      }
    }

    const qty = safeQty(raw.quantity);
    const seq = safeSeq(raw.sequence, ++this.seqCounter);
    const occurredAt = typeof raw.occurredAt === 'number' ? raw.occurredAt : at;
    const replayPolicy: GiftReplayPolicy = raw.replayPolicy ?? 'ACTIVE_FX';
    const expiresAt =
      typeof raw.expiresAt === 'number'
        ? raw.expiresAt
        : occurredAt + GIFT_FULL_FX_REPLAY_TTL_MS;

    if (replayPolicy === 'ACTIVE_FX' && expiresAt <= at) {
      return { accepted: false, reason: 'expired_active_fx', comboUpdated: false };
    }

    const bk = this.baseKey(raw);
    let session = this.openSessions.get(bk);
    if (!session || session.expiresAt <= at) {
      const comboSessionId = newComboSessionId(raw.senderUserId);
      const jobKey = giftAggregationKey({
        roomId: raw.roomId,
        recipientHostId: raw.recipientHostId,
        senderUserId: raw.senderUserId,
        giftId: raw.giftId,
        giftVariantId: raw.giftVariantId,
        comboSessionId,
      });
      session = { comboSessionId, expiresAt: at + GIFT_COMBO_SESSION_MS, jobKey };
      this.openSessions.set(bk, session);
    } else {
      session.expiresAt = at + GIFT_COMBO_SESSION_MS;
    }

    const unitValue =
      typeof raw.unitValue === 'number' && Number.isFinite(raw.unitValue)
        ? Math.max(0, raw.unitValue)
        : typeof raw.starValue === 'number' && Number.isFinite(raw.starValue)
          ? Math.max(0, raw.starValue)
          : 0;

    const existing = this.jobsByKey.get(session.jobKey);
    if (existing && existing.state !== 'FINISHED' && existing.state !== 'CANCELLED') {
      existing.comboQuantity += qty;
      existing.totalValue += unitValue * qty;
      existing.lastSequence = Math.max(existing.lastSequence, seq);
      existing.updatedAt = at;
      existing.expiresAt = Math.max(existing.expiresAt, expiresAt);
      if (eventId) existing.eventIds.push(eventId);
      if (raw.giftTransactionId) existing.giftTransactionIds.push(raw.giftTransactionId);
      // Do NOT change state from PLAYING → restart; quantity HUD updates only.
      return { accepted: true, job: existing, comboUpdated: true };
    }

    const job: GiftPlaybackJob = {
      playbackJobId: newPlaybackJobId(),
      roomId: raw.roomId,
      recipientHostId: raw.recipientHostId,
      senderUserId: raw.senderUserId,
      senderName: raw.senderName?.trim() || 'Guest',
      giftId: raw.giftId,
      variantId: raw.giftVariantId ?? 'default',
      giftName: raw.giftName?.trim() || raw.giftId,
      giftIcon: raw.giftIcon?.trim() || '🎁',
      comboSessionId: session.comboSessionId,
      comboQuantity: qty,
      totalValue: unitValue * qty,
      firstSequence: seq,
      lastSequence: seq,
      firstQualifyingArrivalAt: at,
      createdAt: at,
      updatedAt: at,
      expiresAt,
      state: 'QUEUED',
      replayPolicy,
      eventIds: eventId ? [eventId] : [],
      giftTransactionIds: raw.giftTransactionId ? [raw.giftTransactionId] : [],
      effectUrl: raw.effectUrl ?? null,
      effectKind: raw.effectKind ?? null,
      receiverName: raw.receiverName?.trim() || 'Host',
      starValue: typeof raw.starValue === 'number' ? raw.starValue : unitValue,
      barrageOnly: Boolean(raw.barrageOnly),
    };

    this.jobsByKey.set(session.jobKey, job);
    this.fifo.push(session.jobKey);
    // Stable FIFO — never re-sort by tier.
    return { accepted: true, job, comboUpdated: false };
  }

  /** Start next queued full-FX job if capacity allows. Barrage-only jobs finish immediately. */
  pump(): GiftPlaybackJob | null {
    const at = nowMs();
    this.gc(at);

    if (this.activeJobId) {
      const active = [...this.jobsByKey.values()].find(
        (j) => j.playbackJobId === this.activeJobId,
      );
      if (active && (active.state === 'PLAYING' || active.state === 'PREPARING' || active.state === 'EXITING')) {
        return active;
      }
      this.activeJobId = null;
    }

    while (this.fifo.length > 0) {
      const key = this.fifo[0];
      const job = this.jobsByKey.get(key);
      if (!job || job.state === 'FINISHED' || job.state === 'CANCELLED') {
        this.fifo.shift();
        continue;
      }
      if (job.state !== 'QUEUED') {
        this.fifo.shift();
        continue;
      }

      if (job.barrageOnly) {
        // Combo HUD only — never occupies the single full-FX slot.
        this.fifo.shift();
        continue;
      }

      if (this.maxActiveFullGiftEffects < 1) return null;

      this.fifo.shift();
      job.state = 'PREPARING';
      job.updatedAt = at;
      job.state = 'PLAYING';
      this.activeJobId = job.playbackJobId;
      return job;
    }
    return null;
  }

  /** Mark active full FX finished and open capacity for FIFO next. */
  finishActive(playbackJobId?: string): void {
    const at = nowMs();
    const targetId = playbackJobId ?? this.activeJobId;
    if (!targetId) return;
    for (const [key, job] of this.jobsByKey.entries()) {
      if (job.playbackJobId !== targetId) continue;
      job.state = 'FINISHED';
      job.updatedAt = at;
      if (this.activeJobId === targetId) this.activeJobId = null;
      this.jobsByKey.delete(key);
      this.fifo = this.fifo.filter((k) => k !== key);
      break;
    }
  }

  cancelAll(): void {
    const at = nowMs();
    for (const job of this.jobsByKey.values()) {
      if (job.state !== 'FINISHED') {
        job.state = 'CANCELLED';
        job.updatedAt = at;
      }
    }
    this.jobsByKey.clear();
    this.fifo = [];
    this.activeJobId = null;
    this.openSessions.clear();
  }

  getActive(): GiftPlaybackJob | null {
    if (!this.activeJobId) return null;
    return (
      [...this.jobsByKey.values()].find((j) => j.playbackJobId === this.activeJobId) ?? null
    );
  }

  /** Combo HUD rows (open sessions + active/queued quantities). */
  getComboHud(at = nowMs()): GiftSchedulerSnapshot['combos'] {
    this.gc(at);
    const rows: GiftSchedulerSnapshot['combos'] = [];
    for (const job of this.jobsByKey.values()) {
      if (job.state === 'FINISHED' || job.state === 'CANCELLED') continue;
      const sess = this.openSessions.get(
        [job.roomId, job.recipientHostId, job.senderUserId, job.giftId, job.variantId].join('|'),
      );
      rows.push({
        key: giftAggregationKey({
          roomId: job.roomId,
          recipientHostId: job.recipientHostId,
          senderUserId: job.senderUserId,
          giftId: job.giftId,
          giftVariantId: job.variantId,
          comboSessionId: job.comboSessionId,
        }),
        comboSessionId: job.comboSessionId,
        senderUserId: job.senderUserId,
        senderName: job.senderName,
        giftId: job.giftId,
        giftName: job.giftName,
        giftIcon: job.giftIcon,
        count: job.comboQuantity,
        expiresAt: sess?.expiresAt ?? job.updatedAt + GIFT_COMBO_SESSION_MS,
      });
    }
    return rows.slice(-8);
  }

  snapshot(): GiftSchedulerSnapshot {
    const queued = this.fifo
      .map((k) => this.jobsByKey.get(k))
      .filter((j): j is GiftPlaybackJob => j != null && j.state === 'QUEUED');
    return {
      queued,
      active: this.getActive(),
      combos: this.getComboHud(),
    };
  }

  /** Test helper — FIFO order of job keys. */
  debugFifoKeys(): string[] {
    return [...this.fifo];
  }
}

/** Alias for docs / imports that expect GiftComboAggregator naming. */
export class GiftComboAggregator extends GiftPlaybackScheduler {}

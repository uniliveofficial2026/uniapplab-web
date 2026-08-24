/**
 * Realtime event replay semantics (provider-neutral).
 *
 * STATE — late joiners / reconnect must restore current business state (seats, PK).
 * ACTIVE_FX — full paid gift animations; expires; do not replay after expiresAt.
 * EPHEMERAL — likes / temporary reactions; loss-tolerant; never durable-replayed.
 * NONE — do not restore.
 */

export type RealtimeReplayPolicy = 'STATE' | 'ACTIVE_FX' | 'EPHEMERAL' | 'NONE';

export type RealtimeEventMeta = {
  eventId: string;
  sequence?: number;
  occurredAt: number;
  expiresAt?: number;
  replayPolicy: RealtimeReplayPolicy;
};

export const REALTIME_REPLAY_BY_TYPE: Record<string, RealtimeReplayPolicy> = {
  seats: 'STATE',
  pk: 'STATE',
  lifecycle: 'STATE',
  commerce: 'STATE',
  game: 'STATE',
  gift_play: 'ACTIVE_FX',
  gift: 'ACTIVE_FX',
  like: 'EPHEMERAL',
  follow: 'EPHEMERAL',
};

export function shouldReplayEvent(
  meta: Pick<RealtimeEventMeta, 'replayPolicy' | 'expiresAt'>,
  now = Date.now(),
): boolean {
  if (meta.replayPolicy === 'NONE' || meta.replayPolicy === 'EPHEMERAL') return false;
  if (meta.replayPolicy === 'ACTIVE_FX') {
    if (typeof meta.expiresAt === 'number' && meta.expiresAt <= now) return false;
    return true;
  }
  // STATE — always eligible (caller supplies current snapshot, not historical FX).
  return true;
}

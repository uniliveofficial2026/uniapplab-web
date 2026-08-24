import test from 'node:test';
import assert from 'node:assert/strict';
import { GiftPlaybackScheduler } from '../src/lib/live/giftPlaybackScheduler.ts';

function baseEvent(over = {}) {
  return {
    eventId: `evt_${Math.random().toString(36).slice(2)}`,
    sequence: 1,
    occurredAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    roomId: 'room-1',
    recipientHostId: 'host-1',
    senderUserId: 'user-a',
    giftId: 'kiss',
    giftVariantId: 'default',
    quantity: 1,
    starValue: 1,
    giftTransactionId: `local_settle_${Math.random().toString(36).slice(2)}`,
    barrageOnly: false,
    ...over,
  };
}

test('stress: 500 gift events collapse to FIFO jobs without unbounded active FX', () => {
  const scheduler = new GiftPlaybackScheduler();
  let seq = 0;
  for (let i = 0; i < 500; i += 1) {
    const user = i % 17 === 0 ? `user-${i % 7}` : 'user-a';
    const gift = i % 11 === 0 ? `gift-${i % 5}` : 'kiss';
    scheduler.ingest(
      baseEvent({
        sequence: ++seq,
        senderUserId: user,
        giftId: gift,
        quantity: 1 + (i % 10),
        giftTransactionId: `local_settle_${seq}`,
        eventId: `evt_${seq}`,
      }),
    );
  }
  const snap = scheduler.snapshot();
  assert.ok((snap.active ? 1 : 0) <= 1, 'at most one full FX active');
  assert.ok(snap.queued.length + (snap.active ? 1 : 0) < 500, 'combo aggregation must collapse storm');
  for (let guard = 0; guard < 2000; guard += 1) {
    const s = scheduler.snapshot();
    if (!s.active && s.queued.length === 0) break;
    if (s.active) scheduler.finishActive(s.active.playbackJobId);
    else scheduler.pump();
  }
  const final = scheduler.snapshot();
  assert.equal(final.active, null);
  assert.equal(final.queued.length, 0);
});

test('stress: rapid same-combo sends accumulate quantity without restarting play job', () => {
  const scheduler = new GiftPlaybackScheduler();
  const first = scheduler.ingest(
    baseEvent({ quantity: 1, sequence: 1, eventId: 'e1', giftTransactionId: 'local_settle_1' }),
  );
  assert.ok(first.job);
  const playing = scheduler.pump();
  assert.ok(playing);
  const playingId = playing.playbackJobId;
  for (let i = 0; i < 100; i += 1) {
    const r = scheduler.ingest(
      baseEvent({
        quantity: 3,
        sequence: 2 + i,
        eventId: `e${2 + i}`,
        giftTransactionId: `local_settle_${2 + i}`,
      }),
    );
    assert.equal(r.job?.playbackJobId, playingId, 'combo must not spawn a new job while playing');
  }
  assert.equal(scheduler.snapshot().active?.comboQuantity, 1 + 100 * 3);
});

/**
 * Gift combo / FIFO scheduler + authority wiring tests.
 * Run: node --import tsx --test test/gift-playback-scheduler.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GiftPlaybackScheduler,
  MAX_ACTIVE_FULL_GIFT_EFFECTS,
} from '../src/lib/live/giftPlaybackScheduler.ts';
import {
  canAcceptGiftPlayForFx,
  isAuthoritativeGiftSettlementId,
} from '../src/lib/live/giftAuthority.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('gift scheduler source contracts', () => {
  const src = readFileSync(join(root, 'src/lib/live/giftPlaybackScheduler.ts'), 'utf8');
  assert.ok(src.includes('MAX_ACTIVE_FULL_GIFT_EFFECTS = 1'));
  assert.ok(src.includes('class GiftComboAggregator'));
  assert.ok(src.includes('comboSessionId'));
  assert.ok(src.includes('firstQualifyingArrivalAt'));
});

test('gift overlay uses GiftPlaybackScheduler (no tier sortGiftQueue)', () => {
  const overlay = readFileSync(
    join(root, 'src/smule-rooms/components/GiftPlayOverlay.tsx'),
    'utf8',
  );
  assert.ok(overlay.includes('GiftPlaybackScheduler'));
  assert.ok(overlay.includes('canAcceptGiftPlayForFx'));
  assert.equal(overlay.includes('sortGiftQueue'), false);
  assert.equal(overlay.includes('GIFT_QUEUE_PRIORITY'), false);
});

test('giftEconomy max simultaneous full FX is 1', () => {
  const eco = readFileSync(join(root, 'src/lib/live/giftEconomy.ts'), 'utf8');
  assert.ok(eco.includes('MAX_SIMULTANEOUS_GIFT_ANIMATIONS = 1'));
  assert.ok(eco.includes('MAX_ACTIVE_FULL_GIFT_EFFECTS = 1'));
});

test('authority: playId-shaped ids rejected; local_settle accepted', () => {
  assert.equal(isAuthoritativeGiftSettlementId('gift_1234567890_abcdef'), false);
  assert.equal(isAuthoritativeGiftSettlementId('local_settle_gift_abc'), true);
  assert.equal(canAcceptGiftPlayForFx({ starValue: 100 }), false);
  assert.equal(
    canAcceptGiftPlayForFx({ starValue: 100, giftTransactionId: 'local_settle_x1' }),
    true,
  );
  assert.equal(canAcceptGiftPlayForFx({ starValue: 100 }, { allowPreview: true }), true);
});

test('Room gates remote gift_play on settlement + replay expiry', () => {
  const room = readFileSync(join(root, 'src/smule-rooms/pages/Room.tsx'), 'utf8');
  assert.ok(room.includes('canAcceptGiftPlayForFx'));
  assert.ok(room.includes('giftTransactionId'));
  assert.ok(room.includes('GIFT_FULL_FX_REPLAY_TTL_MS'));
  assert.ok(room.includes("replayPolicy === 'ACTIVE_FX'"));
});

test('combo quantity accumulates units not events (Kiss ×1+×5+×10 = ×16)', () => {
  const s = new GiftPlaybackScheduler();
  assert.equal(MAX_ACTIVE_FULL_GIFT_EFFECTS, 1);
  assert.equal(s.maxActiveFullGiftEffects, 1);
  const base = {
    roomId: 'r1',
    recipientHostId: 'host1',
    senderUserId: 'userA',
    giftId: 'kiss',
    giftName: 'Kiss',
    starValue: 500,
    barrageOnly: false,
  };
  s.ingest({ ...base, eventId: 'e1', quantity: 1, giftTransactionId: 'local_settle_e1' });
  s.ingest({ ...base, eventId: 'e2', quantity: 5, giftTransactionId: 'local_settle_e2' });
  s.ingest({ ...base, eventId: 'e3', quantity: 10, giftTransactionId: 'local_settle_e3' });
  const job = s.pump();
  assert.ok(job);
  assert.equal(job.comboQuantity, 16);
});

test('same user different gifts → separate jobs', () => {
  const s = new GiftPlaybackScheduler();
  const base = {
    roomId: 'r1',
    recipientHostId: 'host1',
    senderUserId: 'userA',
    starValue: 500,
  };
  s.ingest({
    ...base,
    eventId: 'e1',
    giftId: 'kiss',
    quantity: 1,
    giftTransactionId: 'local_settle_e1',
  });
  s.ingest({
    ...base,
    eventId: 'e2',
    giftId: 'rose',
    quantity: 2,
    giftTransactionId: 'local_settle_e2',
  });
  const first = s.pump();
  assert.equal(first?.giftId, 'kiss');
  assert.equal(first?.comboQuantity, 1);
  s.finishActive(first.playbackJobId);
  const second = s.pump();
  assert.equal(second?.giftId, 'rose');
  assert.equal(second?.comboQuantity, 2);
});

test('different users same gift → separate jobs', () => {
  const s = new GiftPlaybackScheduler();
  s.ingest({
    eventId: 'a',
    roomId: 'r',
    recipientHostId: 'h',
    senderUserId: 'u1',
    giftId: 'kiss',
    quantity: 3,
    starValue: 500,
    giftTransactionId: 'local_settle_a',
  });
  s.ingest({
    eventId: 'b',
    roomId: 'r',
    recipientHostId: 'h',
    senderUserId: 'u2',
    giftId: 'kiss',
    quantity: 7,
    starValue: 500,
    giftTransactionId: 'local_settle_b',
  });
  const first = s.pump();
  assert.equal(first?.senderUserId, 'u1');
  assert.equal(first?.comboQuantity, 3);
  s.finishActive(first.playbackJobId);
  const second = s.pump();
  assert.equal(second?.senderUserId, 'u2');
  assert.equal(second?.comboQuantity, 7);
});

test('FIFO: earlier paid job plays before later higher-tier job', () => {
  const s = new GiftPlaybackScheduler();
  s.ingest({
    eventId: 'a',
    roomId: 'r',
    recipientHostId: 'h',
    senderUserId: 'u1',
    giftId: 'rose',
    quantity: 1,
    starValue: 100,
    giftTransactionId: 'local_settle_a',
  });
  s.ingest({
    eventId: 'b',
    roomId: 'r',
    recipientHostId: 'h',
    senderUserId: 'u2',
    giftId: 'yacht',
    quantity: 1,
    starValue: 100_000,
    giftTransactionId: 'local_settle_b',
  });
  const first = s.pump();
  assert.equal(first?.giftId, 'rose');
  s.finishActive(first.playbackJobId);
  const second = s.pump();
  assert.equal(second?.giftId, 'yacht');
});

test('maxActiveFullGiftEffects=1: second pump returns active until finish', () => {
  const s = new GiftPlaybackScheduler();
  s.ingest({
    eventId: 'a',
    roomId: 'r',
    recipientHostId: 'h',
    senderUserId: 'u1',
    giftId: 'a',
    quantity: 1,
    starValue: 500,
    giftTransactionId: 'local_settle_a',
  });
  s.ingest({
    eventId: 'b',
    roomId: 'r',
    recipientHostId: 'h',
    senderUserId: 'u2',
    giftId: 'b',
    quantity: 1,
    starValue: 500,
    giftTransactionId: 'local_settle_b',
  });
  const first = s.pump();
  const again = s.pump();
  assert.equal(again?.playbackJobId, first?.playbackJobId);
  assert.equal(s.snapshot().queued.length, 1);
});

test('combo update while PLAYING does not create a second job', () => {
  const s = new GiftPlaybackScheduler();
  const base = {
    roomId: 'r',
    recipientHostId: 'h',
    senderUserId: 'u',
    giftId: 'kiss',
    starValue: 500,
  };
  s.ingest({ ...base, eventId: 'e1', quantity: 1, giftTransactionId: 'local_settle_e1' });
  const playing = s.pump();
  assert.ok(playing);
  const r = s.ingest({
    ...base,
    eventId: 'e2',
    quantity: 9,
    giftTransactionId: 'local_settle_e2',
  });
  assert.equal(r.comboUpdated, true);
  assert.equal(r.job?.playbackJobId, playing.playbackJobId);
  assert.equal(r.job?.comboQuantity, 10);
  assert.equal(s.snapshot().queued.length, 0);
});

test('expired ACTIVE_FX rejected for late joiners', () => {
  const s = new GiftPlaybackScheduler();
  const r = s.ingest({
    eventId: 'old',
    roomId: 'r',
    recipientHostId: 'h',
    senderUserId: 'u',
    giftId: 'kiss',
    quantity: 1,
    starValue: 500,
    occurredAt: Date.now() - 60_000,
    expiresAt: Date.now() - 1_000,
    replayPolicy: 'ACTIVE_FX',
    giftTransactionId: 'local_settle_old',
  });
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'expired_active_fx');
});

test('duplicate eventId rejected', () => {
  const s = new GiftPlaybackScheduler();
  const base = {
    eventId: 'dup',
    roomId: 'r',
    recipientHostId: 'h',
    senderUserId: 'u',
    giftId: 'kiss',
    quantity: 1,
    starValue: 500,
    giftTransactionId: 'local_settle_dup',
  };
  assert.equal(s.ingest(base).accepted, true);
  assert.equal(s.ingest(base).accepted, false);
});

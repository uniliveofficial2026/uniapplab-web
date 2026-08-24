/**
 * Like / gift realtime publishing through UniLive realtime lanes (not raw LiveKit publishData).
 */
import { createUniLiveRealtime } from '@unilives/realtime';
import { createEventEnvelope } from '@unilives/rtc-core';

const bus = createUniLiveRealtime({ provider: 'memory' });

/** Loss-tolerant likes lane (120ms batching remains in product FX layer). */
export async function publishLikesBatch(payload: Record<string, unknown>) {
  const envelope = createEventEnvelope({
    eventType: 'live.likes.batch',
    lane: 'LOSS_TOLERANT',
    eventClass: 'EPHEMERAL_EVENT',
    properties: payload,
  });
  await bus.publish({ topic: 'likes', lane: 'LOSS_TOLERANT', payload: envelope });
  return envelope;
}

/** Authoritative gift settlement → gift scheduler (transport only). */
export async function publishAuthoritativeGift(payload: Record<string, unknown>) {
  const envelope = createEventEnvelope({
    eventType: 'gift.settled',
    lane: 'SERVER_AUTHORITATIVE',
    eventClass: 'AUTHORITATIVE_EVENT',
    properties: payload,
    replayPolicy: 'until_expiry',
  });
  await bus.publish({ topic: 'gifts', lane: 'SERVER_AUTHORITATIVE', payload: envelope });
  return envelope;
}

export function subscribeLiveRealtime(
  topic: string,
  handler: (msg: { topic: string; lane: string; payload: unknown }) => void,
) {
  return bus.subscribe(topic, handler);
}

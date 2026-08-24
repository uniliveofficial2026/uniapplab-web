/**
 * PK domain orchestrator mirror — gift scores only from authoritative settlement events.
 */
import { createPkOrchestrator } from '@unilives/rtc-core';

const orch = createPkOrchestrator();

export function getPkDomainOrchestrator() {
  return orch;
}

export function startDomainPk(input: {
  pkId?: string;
  roomId: string;
  hostUserId: string;
  opponentUserId: string;
  durationSec?: number;
}) {
  return orch.start(input);
}

export function applyDomainPkGiftScore(input: {
  roomId: string;
  recipientUserId: string;
  points: number;
  giftEventId: string;
}) {
  return orch.applyGiftScore(input);
}

export function endDomainPk(roomId: string) {
  return orch.end(roomId);
}

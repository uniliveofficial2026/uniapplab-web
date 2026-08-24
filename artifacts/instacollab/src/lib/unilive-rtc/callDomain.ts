/**
 * Call domain session manager — Stage A lifecycle preserved, media via UniLiveRTC provider.
 */
import { createCallOrchestrator } from '@unilives/rtc-core';

const orchestrator = createCallOrchestrator();

export function getCallDomainOrchestrator() {
  return orchestrator;
}

export function startDomainCall(input: {
  callerId: string;
  calleeId: string;
  kind?: string;
  callSessionId?: string;
}) {
  return orchestrator.create(input);
}

export function applyDomainCallSignal(input: {
  callSessionId: string;
  signalId?: string;
  type: string;
}) {
  return orchestrator.applySignal(input);
}

export function getDomainCall(callSessionId: string) {
  return orchestrator.get(callSessionId);
}

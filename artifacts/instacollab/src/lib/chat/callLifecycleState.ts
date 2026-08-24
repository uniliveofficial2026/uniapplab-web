/**
 * Production call lifecycle states (provider-neutral).
 * UI continues to use ChatCallPhase; this maps for orchestrators / metering / Stage B.
 */

import type { ChatCallPhase, ChatConnectPhase } from './chatCallKit';

export type CallLifecycleState =
  | 'CREATED'
  | 'RINGING'
  | 'ACCEPTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ENDED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'BUSY'
  | 'TIMED_OUT'
  | 'MISSED'
  | 'FAILED';

export function mapChatCallToLifecycle(input: {
  phase: ChatCallPhase;
  connectPhase: ChatConnectPhase;
  /** Why the call ended, when known */
  endReason?:
    | 'declined'
    | 'cancelled'
    | 'busy'
    | 'timeout'
    | 'missed'
    | 'failed'
    | 'hangup'
    | null;
}): CallLifecycleState {
  const { phase, connectPhase, endReason } = input;
  if (phase === 'ended') {
    switch (endReason) {
      case 'declined':
        return 'DECLINED';
      case 'cancelled':
        return 'CANCELLED';
      case 'busy':
        return 'BUSY';
      case 'timeout':
        return 'TIMED_OUT';
      case 'missed':
        return 'MISSED';
      case 'failed':
        return 'FAILED';
      default:
        return 'ENDED';
    }
  }
  if (phase === 'outgoing' || phase === 'incoming') return 'RINGING';
  if (phase === 'connected') {
    if (connectPhase === 'failed') return 'FAILED';
    if (connectPhase === 'connecting' || connectPhase === 'slow') return 'CONNECTING';
    if (connectPhase === 'connected') return 'CONNECTED';
    return 'CONNECTED';
  }
  if (phase === 'idle') return 'CREATED';
  return 'CREATED';
}

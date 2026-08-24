import test from 'node:test';
import assert from 'node:assert/strict';
import { mapChatCallToLifecycle } from '../src/lib/chat/callLifecycleState.ts';

test('maps ringing / connecting / connected', () => {
  assert.equal(mapChatCallToLifecycle({ phase: 'outgoing', connectPhase: 'idle' }), 'RINGING');
  assert.equal(mapChatCallToLifecycle({ phase: 'incoming', connectPhase: 'idle' }), 'RINGING');
  assert.equal(
    mapChatCallToLifecycle({ phase: 'connected', connectPhase: 'connecting' }),
    'CONNECTING',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'connected', connectPhase: 'slow' }),
    'CONNECTING',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'connected', connectPhase: 'connected' }),
    'CONNECTED',
  );
});

test('maps decline / cancel / busy / timeout / missed / hangup / failed', () => {
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle', endReason: 'declined' }),
    'DECLINED',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle', endReason: 'cancelled' }),
    'CANCELLED',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle', endReason: 'busy' }),
    'BUSY',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle', endReason: 'timeout' }),
    'TIMED_OUT',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle', endReason: 'missed' }),
    'MISSED',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle', endReason: 'hangup' }),
    'ENDED',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle', endReason: 'failed' }),
    'FAILED',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle' }),
    'ENDED',
  );
});

test('connect failure while connected phase maps to FAILED', () => {
  assert.equal(
    mapChatCallToLifecycle({ phase: 'connected', connectPhase: 'failed' }),
    'FAILED',
  );
});

test('idle maps to CREATED (pre-ring)', () => {
  assert.equal(mapChatCallToLifecycle({ phase: 'idle', connectPhase: 'idle' }), 'CREATED');
});

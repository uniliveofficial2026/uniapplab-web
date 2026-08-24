import test from 'node:test';
import assert from 'node:assert/strict';
import { mapChatCallToLifecycle } from '../src/lib/chat/callLifecycleState.ts';

test('maps ringing / connected / declined / timeout', () => {
  assert.equal(mapChatCallToLifecycle({ phase: 'outgoing', connectPhase: 'idle' }), 'RINGING');
  assert.equal(mapChatCallToLifecycle({ phase: 'incoming', connectPhase: 'idle' }), 'RINGING');
  assert.equal(
    mapChatCallToLifecycle({ phase: 'connected', connectPhase: 'connecting' }),
    'CONNECTING',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'connected', connectPhase: 'connected' }),
    'CONNECTED',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle', endReason: 'declined' }),
    'DECLINED',
  );
  assert.equal(
    mapChatCallToLifecycle({ phase: 'ended', connectPhase: 'idle', endReason: 'timeout' }),
    'TIMED_OUT',
  );
});

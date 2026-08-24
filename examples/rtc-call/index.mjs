import { createFakeRTCProvider } from '@unilives/rtc-fake';
import { createUniLive } from '@unilives/sdk';
const provider = createFakeRTCProvider({ identity: 'caller' });
const uni = createUniLive({ projectId: 'example_call', environment: 'local', provider, roomType: 'CALL_1_TO_1' });
const joined = await uni.rtc.joinRoom({
  roomId: 'call-1',
  token: 'x',
  url: 'fake://',
  canonicalUserId: 'caller',
});
await joined.leave();
console.log(JSON.stringify({ ok: true, roomId: 'call-1' }));

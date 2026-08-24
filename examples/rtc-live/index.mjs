import { createFakeRTCProvider } from '@unilives/rtc-fake';
import { createUniLive } from '@unilives/sdk';
const provider = createFakeRTCProvider({ identity: 'host', roomType: 'LIVE' });
const uni = createUniLive({ projectId: 'example_live', environment: 'local', provider, roomType: 'LIVE' });
const joined = await uni.rtc.joinRoom({
  roomId: 'live-1',
  token: 'x',
  url: 'fake://',
  canonicalUserId: 'host',
});
await joined.leave();
console.log(JSON.stringify({ ok: true, roomId: 'live-1' }));

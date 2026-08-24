import { createUniLive } from '@unilives/sdk';
const uni = createUniLive({ projectId: 'example_realtime', environment: 'local' });
const unsub = await uni.realtime.subscribe();
unsub();
console.log(JSON.stringify({ ok: true, provider: uni.realtime.provider }));

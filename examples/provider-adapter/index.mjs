import { createTestRtcProviderAdapter, providerSupports } from '@unilives/provider-sdk';
const p = createTestRtcProviderAdapter();
await p.createRoom('demo');
console.log(JSON.stringify({ ok: true, supportsRooms: providerSupports(p.manifest, 'rtc.rooms'), rooms: p.listRooms().length }));

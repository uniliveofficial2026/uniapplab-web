import { createUniLive } from '@unilives/sdk';
const uni = createUniLive({ projectId: 'example_storage', environment: 'local' });
const list = await uni.storage.list();
console.log(JSON.stringify({ ok: true, objects: list.length, provider: uni.storage.provider }));

import { createUniLive } from '@unilives/sdk';
const uni = createUniLive({ projectId: 'example_db', environment: 'local' });
console.log(JSON.stringify({ ok: true, provider: uni.database.provider }));

import { createUniLive, PLATFORM_VERSION } from '@unilives/sdk';
const uni = createUniLive({ projectId: 'example_basic', environment: 'local' });
console.log(JSON.stringify({ ok: true, version: PLATFORM_VERSION, projectId: uni.projectId }));

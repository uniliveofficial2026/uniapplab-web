import { initSelfHost, getSelfHostStatus } from '@unilives/selfhost';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dataDir = await mkdtemp(join(tmpdir(), 'example-selfhost-'));
await initSelfHost({ dataDir, projectName: 'example-selfhost' });
const status = await getSelfHostStatus({ dataDir, json: true });
console.log('PASS', JSON.stringify({ ok: status.ok, components: status.components.length }));

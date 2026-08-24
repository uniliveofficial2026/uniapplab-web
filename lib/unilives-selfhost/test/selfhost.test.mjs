import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';
import {
  COMPONENTS,
  backupSelfHost,
  destroySelfHostState,
  generateComposeTemplate,
  getSelfHostStatus,
  initSelfHost,
  restoreSelfHost,
  upgradePreflight,
} from '../index.mjs';

test('compose template includes core components', async () => {
  const compose = await generateComposeTemplate({ projectName: 'test' });
  for (const name of ['postgres', 'auth', 'api', 'livekit', 'observability']) {
    assert.match(compose, new RegExp(`\\b${name}\\b`));
  }
  assert.match(compose, /Caddy/i);
});

test('init writes placeholders not production secrets', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'selfhost-init-'));
  const result = await initSelfHost({ dataDir, projectName: 'demo' });
  assert.equal(result.ok, true);
  const config = JSON.parse(await readFile(result.configPath, 'utf8'));
  assert.match(String(config.env.POSTGRES_PASSWORD), /^CHANGE_ME_/);
  assert.match(String(config.env.JWT_SECRET), /^CHANGE_ME_/);
  assert.equal(config.components.length, COMPONENTS.length);
});

test('status human and json modes', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'selfhost-status-'));
  await initSelfHost({ dataDir });
  const json = await getSelfHostStatus({ dataDir, json: true });
  assert.equal(json.ok, true);
  assert.ok(json.components.length >= 9);
  const human = await getSelfHostStatus({ dataDir, json: false });
  assert.match(String(human.human), /UniLive self-host/);
});

test('backup restore cycle destroys and verifies data', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'selfhost-br-'));
  const backupDir = await mkdtemp(join(tmpdir(), 'selfhost-br-backup-'));
  await initSelfHost({ dataDir, projectName: 'restore-demo' });

  const seeded = await getSelfHostStatus({ dataDir, json: true });
  assert.ok(seeded.postgres.records >= 1);

  const backup = await backupSelfHost({ dataDir, outPath: join(backupDir, 'snapshot.json') });
  assert.equal(backup.ok, true);

  await destroySelfHostState(dataDir);
  await restoreSelfHost({ dataDir, backupPath: backup.outPath, destroyExisting: false });

  const after = await getSelfHostStatus({ dataDir, json: true });
  assert.equal(after.projectName, 'restore-demo');
  assert.equal(after.postgres.records, seeded.postgres.records);
});

test('upgrade preflight reports warnings for placeholders', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'selfhost-upg-'));
  await initSelfHost({ dataDir });
  const preflight = await upgradePreflight({ dataDir, targetVersion: '0.2.0' });
  assert.equal(preflight.ok, true);
  assert.ok(preflight.warnings.includes('placeholder_secrets_detected'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  STAGE_C_TEMPLATE_MANIFESTS,
  PRIVILEGED_PERMISSIONS,
  computeManifestIntegrity,
  createMarketplaceRegistry,
  validateInstallSafety,
  validateManifest,
} from '../index.mjs';

test('seed includes six Stage C templates', () => {
  assert.equal(STAGE_C_TEMPLATE_MANIFESTS.length, 6);
  const ids = STAGE_C_TEMPLATE_MANIFESTS.map((m) => m.id);
  for (const id of [
    'unilives.template.basic',
    'unilives.template.social',
    'unilives.template.reels',
    'unilives.template.livestream',
    'unilives.template.call',
    'unilives.template.marketplace',
  ]) {
    assert.ok(ids.includes(id));
  }
});

test('validateManifest rejects secret fields', () => {
  const base = structuredClone(STAGE_C_TEMPLATE_MANIFESTS[0]);
  /** @type {any} */ (base).apiKey = 'sk_test_bad';
  const result = validateManifest(base);
  assert.equal(result.ok, false);
  assert.ok(result.errors?.some((e) => e.includes('secret')));
});

test('integrity verification matches canonical hash', () => {
  for (const manifest of STAGE_C_TEMPLATE_MANIFESTS) {
    assert.equal(computeManifestIntegrity(manifest), manifest.integrity.hash);
  }
});

test('privileged permissions block auto install', () => {
  const manifest = structuredClone(STAGE_C_TEMPLATE_MANIFESTS[0]);
  manifest.permissions = ['shell'];
  manifest.integrity.hash = computeManifestIntegrity(manifest);
  assert.throws(() => validateInstallSafety(manifest), /privileged_permissions_not_granted/);
  assert.doesNotThrow(() => validateInstallSafety(manifest, { grantedPermissions: ['shell'] }));
});

test('registry list search get install remove', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'marketplace-'));
  const registry = createMarketplaceRegistry({ registryDir: dir, seed: true });
  const list = registry.list({ type: 'template' });
  assert.equal(list.length, 6);
  const found = registry.search('live');
  assert.ok(found.some((r) => r.id.includes('livestream')));
  const manifest = registry.get('unilives.template.basic');
  assert.equal(manifest.type, 'template');

  const install = await registry.install('unilives.template.basic', { installDir: true });
  assert.equal(install.ok, true);
  assert.ok(registry.isInstalled('unilives.template.basic'));
  const files = await registry.listPackageFiles('unilives.template.basic');
  assert.ok(files.includes('manifest.json'));

  await registry.remove('unilives.template.basic');
  assert.equal(registry.isInstalled('unilives.template.basic'), false);
});

test('PRIVILEGED_PERMISSIONS covers required caps', () => {
  for (const cap of ['secret.read', 'db.admin', 'deploy.mutate', 'filesystem.root', 'shell']) {
    assert.ok(PRIVILEGED_PERMISSIONS.has(cap));
  }
});

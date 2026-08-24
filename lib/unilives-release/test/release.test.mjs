import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_VERSION, createReleaseManifest, createReleaseArtifactEntry } from '../index.mjs';

test('platform version is semver-like', () => {
  assert.match(PLATFORM_VERSION, /^\d+\.\d+\.\d+/);
});

test('release manifest includes checksum and external registry status', () => {
  const art = createReleaseArtifactEntry({
    package: '@unilives/sdk',
    artifact: 'unilives-sdk-0.1.0.tgz',
    content: 'demo',
  });
  assert.ok(art.checksum?.startsWith('sha256:'));
  const man = createReleaseManifest([art]);
  assert.equal(man.publicRegistryRelease, 'RELEASE_READY_EXTERNAL_STEP');
  assert.equal(man.version, PLATFORM_VERSION);
});

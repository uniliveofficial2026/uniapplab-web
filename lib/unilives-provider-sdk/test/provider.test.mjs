import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestRtcProviderAdapter, providerSupports } from '../index.mjs';

test('external test provider without platform internals', async () => {
  const p = createTestRtcProviderAdapter();
  assert.equal(providerSupports(p.manifest, 'rtc.rooms'), true);
  await p.createRoom('r1');
  assert.equal(p.listRooms().length, 1);
  assert.equal((await p.health()).state, 'HEALTHY');
});

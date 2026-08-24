import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('social: followBlocked cloud path uses cloudFollowToggle when enabled', () => {
  const src = read('src/lib/db/domains/followBlocked.ts');
  assert.match(src, /cloudFollowToggle/);
  assert.match(src, /isCloudFollowsEnabled/);
  assert.match(src, /getCachedFollowerIds/);
  assert.match(src, /getCachedFollowingIds/);
});

test('social: block/unblock are first-class APIs on FollowBlockedLayer', () => {
  const src = read('src/lib/db/domains/followBlocked.ts');
  assert.match(src, /blockUser\(/);
  assert.match(src, /unblockUser\(/);
});

test('social: UI screens call db.blockUser without client-side count forgery helpers', () => {
  const profile = read('src/components/profile/ProfileScreen.tsx');
  assert.match(profile, /db\.blockUser/);
  assert.match(profile, /db\.unblockUser/);
  assert.doesNotMatch(profile, /setFollowerCount\s*\(\s*\d+\s*\+\s*\d+/);
});

test('social: delta sync prefers entity sync over whole-account blob', () => {
  const sync = read('test/social-delta-sync.test.mjs');
  assert.match(sync, /entity sync/);
});

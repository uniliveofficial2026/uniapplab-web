import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VALID_TEAM_PK_SIZES,
  normalizeTeamPkSize,
  resolveDeclaredTeamPkSize,
  pkTopologyKindFromTeamSize,
  clampPkTeamRoster,
  pkSidePublisherBudget,
  mapUserIdToPkSide,
} from '../src/lib/live/pkTeamTopology.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('PK team sizes cover 2v2–6v6; 1v1 via side budget', () => {
  assert.deepEqual([...VALID_TEAM_PK_SIZES], [2, 3, 4, 6]);
  assert.equal(pkTopologyKindFromTeamSize(1), '1v1');
  assert.equal(pkSidePublisherBudget(1), 1);
  for (const n of VALID_TEAM_PK_SIZES) {
    assert.equal(pkTopologyKindFromTeamSize(n), `${n}v${n}`);
    assert.equal(pkSidePublisherBudget(n), n);
  }
});

test('PK normalize/resolve prefer declared size over sparse roster collapse', () => {
  assert.equal(normalizeTeamPkSize(5), 4);
  assert.equal(normalizeTeamPkSize(7), 6);
  assert.equal(resolveDeclaredTeamPkSize(6, 1, 1), 6);
  assert.equal(resolveDeclaredTeamPkSize(null, 3, 3), 3);
});

test('PK roster clamp keeps captain first and respects size', () => {
  const roster = clampPkTeamRoster(['b', 'c', 'a', 'd'], 'a', 3);
  assert.deepEqual(roster, ['a', 'b', 'c']);
});

test('PK side mapping is by canonical user id', () => {
  assert.equal(mapUserIdToPkSide('u1', ['u1'], ['u2']), 'host');
  assert.equal(mapUserIdToPkSide('u2', ['u1'], ['u2']), 'opponent');
  assert.equal(mapUserIdToPkSide('x', ['u1'], ['u2']), null);
});

test('seat publish: LiveKit token route derives canPublish from seat/host not client flag', () => {
  const src = fs.readFileSync(
    path.join(root, '../api-server/src/routes/livekit.ts'),
    'utf8',
  );
  assert.match(src, /seatedPublisher/);
  assert.match(src, /canPublish/);
  assert.match(src, /wantHidden/);
});

test('multi-guest hook publishes only when canPublish true', () => {
  const src = fs.readFileSync(
    path.join(root, 'src/smule-rooms/hooks/useMultiGuestLiveKit.ts'),
    'utf8',
  );
  assert.match(src, /fetchPartyLiveKitToken\(roomId, hidden \? false : canPublish/);
});

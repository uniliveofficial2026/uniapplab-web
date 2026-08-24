import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clampPkTeamRoster,
  mapUserIdToPkSide,
  normalizeTeamPkSize,
  pkSidePublisherBudget,
  pkTopologyKindFromTeamSize,
  resolveDeclaredTeamPkSize,
} from '../src/lib/live/pkTeamTopology.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('normalizeTeamPkSize maps to valid 2/3/4/6 topologies', () => {
  assert.equal(normalizeTeamPkSize(1), 2);
  assert.equal(normalizeTeamPkSize(2), 2);
  assert.equal(normalizeTeamPkSize(3), 3);
  assert.equal(normalizeTeamPkSize(4), 4);
  assert.equal(normalizeTeamPkSize(5), 4);
  assert.equal(normalizeTeamPkSize(6), 6);
  assert.equal(normalizeTeamPkSize(9), 6);
});

test('resolveDeclaredTeamPkSize prefers declared size over sparse roster length', () => {
  assert.equal(resolveDeclaredTeamPkSize(6, 1, 1), 6);
  assert.equal(resolveDeclaredTeamPkSize(2, 6, 6), 2);
  assert.equal(resolveDeclaredTeamPkSize(undefined, 5, 5), 4);
  assert.equal(pkTopologyKindFromTeamSize(1), '1v1');
  assert.equal(pkTopologyKindFromTeamSize(6), '6v6');
  assert.equal(pkSidePublisherBudget(6), 6);
});

test('clampPkTeamRoster keeps captain first and clamps to topology', () => {
  const roster = clampPkTeamRoster(['b', 'a', 'c', 'd', 'e', 'f', 'g'], 'a', 6);
  assert.deepEqual(roster, ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(mapUserIdToPkSide('b', roster, ['x']), 'host');
  assert.equal(mapUserIdToPkSide('x', roster, ['x']), 'opponent');
  assert.equal(mapUserIdToPkSide('z', roster, ['x']), null);
});

test('teamPkSessionFromSnapshot wiring clamps roster to declared teamSize', () => {
  const sessionSrc = read('artifacts/instacollab/src/lib/live/teamPkSession.ts');
  assert.match(sessionSrc, /resolveDeclaredTeamPkSize/);
  assert.match(sessionSrc, /clampPkTeamRoster/);
  assert.match(sessionSrc, /from '\.\/pkTeamTopology'/);
});

test('legacy seat mapper and pad support 6v6 per-side caps', () => {
  const layout = read('artifacts/instacollab/src/smule-rooms/utils/pkBattleLayout.ts');
  assert.match(layout, /teamSize: 2 \| 3 \| 4 \| 6 = 4/);
  assert.match(layout, /if \(teamB\.length >= perSide\) break/);
  assert.match(layout, /Math\.min\(6, count\)/);
  assert.match(layout, /padPkTeamFighters\([\s\S]*teamSize: 2 \| 3 \| 4 \| 6 = 4/);
});

test('Team PK containers keep LiveKit track.attach path and declared teamSize clamp', () => {
  const container = read('artifacts/instacollab/src/components/live/TeamPkSessionContainer.tsx');
  const room = read('artifacts/instacollab/src/components/live/TeamPkRoom.tsx');
  assert.match(container, /typeof track\.attach !== ['"]function['"]/);
  assert.match(container, /hostTeamIds\.slice\(0, session\.teamSize\)/);
  assert.match(container, /opponentTeamIds\.slice\(0, session\.teamSize\)/);
  assert.match(room, /declaredTeamSize === 2 \|\| declaredTeamSize === 3/);
});

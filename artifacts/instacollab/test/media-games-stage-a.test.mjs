import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NewestFrameOnlyGate, MEDIA_RENDER_ORDER } from '../src/lib/media/mediaRenderGraph.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('media graph: newest-frame gate drops stale tickets', () => {
  const gate = new NewestFrameOnlyGate();
  const a = gate.next();
  const b = gate.next();
  assert.equal(gate.isCurrent(a), false);
  assert.equal(gate.isCurrent(b), true);
});

test('media graph: FaceAR imports NewestFrameOnlyGate + SharedVision publish', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/ar/useFaceAR.ts'), 'utf8');
  assert.match(src, /NewestFrameOnlyGate/);
  assert.match(src, /publishSharedVisionState/);
  assert.match(src, /never waits on AI|newest-frame-only/i);
});

test('media graph: render order keeps camera before beauty/AI stages', () => {
  assert.equal(MEDIA_RENDER_ORDER[0], 'camera');
  assert.ok(MEDIA_RENDER_ORDER.indexOf('beauty') < MEDIA_RENDER_ORDER.indexOf('ar_gifts'));
});

test('games: GameLivePanel clears intervals and releases active game on close', () => {
  const src = fs.readFileSync(
    path.join(root, 'src/smule-rooms/components/GameLivePanel.tsx'),
    'utf8',
  );
  assert.match(src, /clearInterval/);
  assert.match(src, /releaseActiveGame/);
  assert.match(src, /setArcadeGameActive\(id, playerKey, false\)/);
});

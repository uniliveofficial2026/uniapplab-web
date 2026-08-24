import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReelVideoPreload } from '../src/lib/reels/reelPlayRules.ts';

test('reels: only active reel gets auto preload under good thermal', () => {
  const good = { allowPrefetch: true, fxBudget: 1 };
  assert.equal(computeReelVideoPreload(true, good), 'auto');
  assert.equal(computeReelVideoPreload(false, good), 'metadata');
});

test('reels: thermal poor disables offscreen prefetch', () => {
  const poor = { allowPrefetch: false, fxBudget: 0.3 };
  assert.equal(computeReelVideoPreload(true, poor), 'auto');
  assert.equal(computeReelVideoPreload(false, poor), 'none');
});

test('reels: long virtual scroll keeps at most one auto preload slot', () => {
  const good = { allowPrefetch: true, fxBudget: 1 };
  const windowSize = 40;
  let activeIndex = 0;
  for (let scroll = 0; scroll < 500; scroll += 1) {
    activeIndex = scroll % windowSize;
    let autoCount = 0;
    for (let i = 0; i < windowSize; i += 1) {
      if (computeReelVideoPreload(i === activeIndex, good) === 'auto') autoCount += 1;
    }
    assert.equal(autoCount, 1);
  }
});

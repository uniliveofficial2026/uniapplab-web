/**
 * Regression checks for reel autoplay preview + tap play/pause.
 * Run: node scripts/test-reels-playback.mjs
 */
import assert from 'node:assert/strict';
import {
  computeReelInlineWantsPlay,
  shouldShowReelPlayOverlay,
  toggleReelPlaying,
} from '../src/lib/reels/reelPlayRules.ts';

const base = {
  isActive: true,
  isPlaying: true,
  showVideoSlide: true,
  isContentFullscreen: false,
  mediaOverlayLocked: false,
  hasSoundtrack: false,
  isCreatorEditingActive: false,
  isCommentsOpen: false,
};

assert.equal(computeReelInlineWantsPlay(base), true, 'active video should autoplay');
assert.equal(
  computeReelInlineWantsPlay({ ...base, isActive: false }),
  false,
  'inactive reel must not autoplay',
);
assert.equal(
  computeReelInlineWantsPlay({ ...base, isPlaying: false }),
  false,
  'paused reel must not want play',
);
assert.equal(
  computeReelInlineWantsPlay({ ...base, mediaOverlayLocked: true }),
  false,
  'overlay lock must block autoplay',
);
assert.equal(
  computeReelInlineWantsPlay({ ...base, isCommentsOpen: true }),
  false,
  'comments open must pause preview',
);
assert.equal(
  computeReelInlineWantsPlay({ ...base, hasSoundtrack: true }),
  false,
  'soundtrack reels mute inline video play',
);

assert.equal(toggleReelPlaying(true), false, 'tap pause');
assert.equal(toggleReelPlaying(false), true, 'tap play');

assert.equal(
  shouldShowReelPlayOverlay({
    showVideoSlide: true,
    isPlaying: false,
    isFullscreenUi: false,
  }),
  false,
  'native controls — no custom Play overlay',
);
assert.equal(
  shouldShowReelPlayOverlay({
    showVideoSlide: true,
    isPlaying: true,
    isFullscreenUi: false,
  }),
  false,
  'playing video must hide Play overlay',
);
assert.equal(
  shouldShowReelPlayOverlay({
    showVideoSlide: true,
    isPlaying: false,
    isFullscreenUi: true,
  }),
  false,
  'fullscreen must hide inline Play overlay',
);

console.log('ok: reel autoplay + tap play/pause rules');

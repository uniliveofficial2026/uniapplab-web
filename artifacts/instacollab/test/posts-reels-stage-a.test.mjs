/**
 * Stage A — Posts + Reels production path contracts (source + pure unit).
 * Run: node --import tsx --test test/posts-reels-stage-a.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeReelInlineWantsPlay,
  computeReelVideoPreload,
  toggleReelPlaying,
} from '../src/lib/reels/reelPlayRules.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('supabase deleteCloudPost requires session userId + author_id filter', () => {
  const src = read('src/lib/supabase/cloudPosts.ts');
  assert.match(src, /export async function deleteCloudPost\(postId: string, userId\?: string\)/);
  assert.match(src, /canUseCloudPosts\(userId\)/);
  assert.match(src, /\.eq\('author_id', userId\)/);
  assert.match(src, /hasSupabaseSessionForUser/);
});

test('upsertCloudPost gates on canUseCloudPosts(authorId)', () => {
  const src = read('src/lib/supabase/cloudPosts.ts');
  assert.match(src, /export async function upsertCloudPost/);
  assert.match(src, /canUseCloudPosts\(authorId\)/);
  assert.match(src, /uploadBlobToR2/);
});

test('postsCloud delete requires userId before backend call', () => {
  const src = read('src/lib/cloudSocial/postsCloud.ts');
  assert.match(src, /if \(!postId \|\| !userId\) return false/);
  assert.match(src, /deleteSupabaseCloudPost\(postId, userId\)/);
  assert.match(src, /deleteFirebaseCloudPost\(postId, userId\)/);
});

test('firebase delete verifies author_id matches caller', () => {
  const src = read('src/lib/firebase/cloudPosts.ts');
  assert.match(src, /deleteFirebaseCloudPost/);
  assert.match(src, /authorId !== userId/);
  assert.match(src, /isCloudAuthUserId\(userId\)/);
});

test('addPost / addReel bind author to currentUser when logged in', () => {
  const posts = read('src/lib/db/domains/authPosts.ts');
  const reels = read('src/lib/db/domains/reels.ts');
  assert.match(posts, /Logged-in creates always bind to currentUser/);
  assert.match(posts, /this\.isLoggedIn && me\?\.id/);
  assert.match(reels, /local\.isLoggedIn && me\?\.id/);
  assert.match(reels, /scheduleCloudReelDelete\(id, meId\)/);
});

test('comment identity enrichment forces session user when logged in', () => {
  const src = read('src/lib/db/domains/authPosts.ts');
  assert.match(src, /enrichCommentPayload/);
  assert.match(src, /comment identity is always the session user/);
  assert.match(src, /userId: meId/);
});

test('comment likes prefer session actorId over spoofed userId', () => {
  const src = read('src/lib/db/domains/comments.ts');
  assert.match(src, /const actorId = meId \|\| userId/);
  assert.match(src, /likedBy\.includes\(actorId\)/);
});

test('cloud engagement apply uses inbound helpers (no buggy isSaved ternary)', () => {
  const src = read('src/lib/cloudSocial/cloudSocialContent.ts');
  assert.match(src, /applyInboundPostEngagement/);
  assert.match(src, /applyInboundReelEngagement/);
  assert.equal(src.includes('p.isSaved && mySaves.has(key) ? true : mySaves.has(key)'), false);
  assert.match(src, /queueCloudEngagement/);
  assert.match(src, /user_id: me/);
  assert.match(src, /author_id: me/);
});

test('R2 post media upload path is wired through uploadPostMediaBlob', () => {
  const cloud = read('src/lib/supabase/cloudPosts.ts');
  const sync = read('src/lib/cloudPostSync.ts');
  assert.match(cloud, /folder: 'posts'/);
  assert.match(cloud, /uploadBlobToR2/);
  assert.match(sync, /uploadPostMediaBlob/);
  assert.match(sync, /scheduleCloudPostPublish/);
  assert.match(sync, /mergeInboundPosts/);
});

test('reels screen wires thermal computeReelVideoPreload', () => {
  const src = read('src/components/reels/ReelsScreen.tsx');
  assert.match(src, /computeReelVideoPreload\(isActive, getThermalPolicy\(\)\)/);
  assert.match(src, /getThermalPolicy/);
  assert.match(src, /useReelsActiveIndex/);
  assert.match(src, /computeReelInlineWantsPlay/);
});

test('unit: computeReelVideoPreload active / prefetch / fxBudget', () => {
  assert.equal(computeReelVideoPreload(true, { allowPrefetch: false, fxBudget: 0.1 }), 'auto');
  assert.equal(computeReelVideoPreload(false, { allowPrefetch: true, fxBudget: 1 }), 'metadata');
  assert.equal(computeReelVideoPreload(false, { allowPrefetch: false, fxBudget: 1 }), 'none');
  assert.equal(computeReelVideoPreload(false, { allowPrefetch: true, fxBudget: 0.5 }), 'none');
  assert.equal(computeReelVideoPreload(false, { allowPrefetch: true, fxBudget: 0.55 }), 'metadata');
});

test('unit: inactive reel must not want play', () => {
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
  assert.equal(computeReelInlineWantsPlay(base), true);
  assert.equal(computeReelInlineWantsPlay({ ...base, isActive: false }), false);
  assert.equal(toggleReelPlaying(true), false);
});

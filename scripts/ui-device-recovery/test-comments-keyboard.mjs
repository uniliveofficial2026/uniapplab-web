#!/usr/bin/env node
/**
 * test:comments-keyboard — comment composers wired to keyboard SSOT.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'artifacts/instacollab');

function read(rel) {
  return fs.readFileSync(path.join(app, rel), 'utf8');
}

const surfaces = [
  {
    id: 'feed-inline-comment',
    file: 'src/components/feed/PostCardFooter.tsx',
    must: [/feed-comment-input/, /pb-composer/, /keyboardInputClassName/],
  },
  {
    id: 'post-modal-comment',
    file: 'src/components/feed/PostModal.tsx',
    must: [/post-comment-input/, /pb-composer/, /keyboardInputClassName/],
  },
  {
    id: 'reels-comments-drawer',
    file: 'src/components/reels/ReelsCommentsDrawer.tsx',
    must: [
      /reels-comment-input/,
      /pb-composer/,
      /keyboardAwareSheetClassName/,
      /keyboardInputClassName/,
    ],
  },
  {
    id: 'comment-author-ssot',
    file: 'src/lib/db/domains/authPosts.ts',
    must: [/enrichCommentPayload/, /userId:\s*meId/, /no client spoof/i],
  },
];

for (const surface of surfaces) {
  const src = read(surface.file);
  for (const re of surface.must) {
    assert.match(src, re, `${surface.id} missing ${re}`);
  }
  console.log(`PASS ${surface.id}`);
}

console.log('\ncomments-keyboard static gates PASS');

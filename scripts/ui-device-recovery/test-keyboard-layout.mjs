#!/usr/bin/env node
/**
 * test:keyboard-layout — asserts keyboard SSOT + critical composers wire insets.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(__dirname, '../../artifacts/instacollab');

function read(rel) {
  return fs.readFileSync(path.join(app, rel), 'utf8');
}

const surfaces = [
  {
    id: 'messages-composer',
    file: 'src/components/messages/MessagesComposeBar.tsx',
    must: [/chat-input/, /composer-bottom-inset|pb-composer|pb-keyboard/],
  },
  {
    id: 'live-chat',
    file: 'src/smule-rooms/components/SoloLiveView.tsx',
    must: [/live-chat-input/],
  },
  {
    id: 'live-footer-css',
    file: 'src/smule-rooms/components/solo-shop-live-approved.css',
    must: [/composer-bottom-inset/],
  },
  {
    id: 'call-overlay',
    file: 'src/components/messages/MessagesActiveCallOverlay.tsx',
    must: [/composer-bottom-inset|keyboard-inset|safe-bottom/],
  },
  {
    id: 'feed-comment',
    file: 'src/components/feed/PostCardFooter.tsx',
    must: [/feed-comment-input/, /pb-composer/],
  },
  {
    id: 'post-modal-comment',
    file: 'src/components/feed/PostModal.tsx',
    must: [/post-comment-input/, /pb-composer/],
  },
  {
    id: 'reels-comment',
    file: 'src/components/reels/ReelsCommentsDrawer.tsx',
    must: [/reels-comment-input/, /pb-composer/, /keyboardAwareSheetClassName/],
  },
  {
    id: 'keyboard-layout-ssot',
    file: 'src/components/common/keyboardLayout.ts',
    must: [/keyboardComposerClassName/, /keyboardAwareSheetClassName/],
  },
  {
    id: 'cap-keyboard',
    file: 'src/lib/bootNativeShell.ts',
    must: [/KeyboardResize\.None/, /keyboardWillShow/, /setNativeKeyboardHeight/],
  },
  {
    id: 'safe-area-ssot',
    file: 'src/lib/safeArea.ts',
    must: [
      /keyboardInset/,
      /dataset\.keyboardOpen/,
      /requestAnimationFrame/,
      /staticBottom/,
      /root\.style\.setProperty\('--app-safe-bottom', `\$\{staticBottom\}px`\)/,
    ],
    mustNot: [/const bottom = Math\.max\(env\.bottom, vv\.bottom/],
  },
  {
    id: 'shell-bottom-offset-keyboard',
    file: 'src/lib/safeArea.ts',
    must: [
      /keyboardOpen\s*\?\s*`0px`\s*:\s*`calc\(\$\{staticBottom\}px \+ var\(--app-mobile-bottom-nav-h/,
    ],
  },
];

const results = [];
for (const surface of surfaces) {
  const src = read(surface.file);
  for (const re of surface.must) {
    assert.match(src, re, `${surface.id} missing ${re}`);
  }
  for (const re of surface.mustNot || []) {
    assert.ok(!re.test(src), `${surface.id} forbidden pattern ${re}`);
  }
  results.push({ id: surface.id, status: 'PASS_STATIC' });
}

// Published SPA must match recovery bundle (when deploy/spa-public exists)
const repoRoot = path.resolve(__dirname, '../..');
const deployIndex = path.join(repoRoot, 'deploy/spa-public/index.html');
if (fs.existsSync(deployIndex)) {
  const html = fs.readFileSync(deployIndex, 'utf8');
  assert.match(html, /index-D9YZUFCc\.js|index-[A-Za-z0-9_-]+\.js/, 'deploy index missing entry js');
  const deployJs = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/)?.[1];
  if (deployJs) {
    const js = fs.readFileSync(path.join(repoRoot, 'deploy/spa-public/assets', deployJs), 'utf8');
    assert.match(js, /app-composer-bottom-inset/, 'deploy bundle missing composer inset');
    assert.match(js, /KeyboardResize/, 'deploy bundle missing KeyboardResize');
    assert.match(js, /home-nav|signed-in-shell/, 'deploy bundle missing shell landmarks');
  }
  results.push({ id: 'deploy-spa-bundle', status: 'PASS_STATIC' });
}

console.log(JSON.stringify({ ok: true, surfaces: results }, null, 2));

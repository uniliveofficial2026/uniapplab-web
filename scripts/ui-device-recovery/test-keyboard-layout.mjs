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
    id: 'cap-keyboard',
    file: 'src/lib/bootNativeShell.ts',
    must: [/KeyboardResize\.None/, /keyboardWillShow/, /setNativeKeyboardHeight/],
  },
  {
    id: 'safe-area-ssot',
    file: 'src/lib/safeArea.ts',
    must: [/keyboardInset/, /dataset\.keyboardOpen/, /requestAnimationFrame/],
  },
];

const results = [];
for (const surface of surfaces) {
  const src = read(surface.file);
  for (const re of surface.must) {
    assert.match(src, re, `${surface.id} missing ${re}`);
  }
  results.push({ id: surface.id, status: 'PASS_STATIC' });
}

console.log(JSON.stringify({ ok: true, surfaces: results }, null, 2));

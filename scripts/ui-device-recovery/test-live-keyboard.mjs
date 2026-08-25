#!/usr/bin/env node
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
    id: 'solo-live-chat',
    file: 'src/smule-rooms/components/SoloLiveView.tsx',
    must: [/live-chat-input/, /data-testid="live-chat-input"/],
  },
  {
    id: 'solo-live-footer-css',
    file: 'src/smule-rooms/components/solo-shop-live-approved.css',
    must: [/composer-bottom-inset/, /approved-live-chat-form/],
  },
  {
    id: 'multiguest-live',
    file: 'src/smule-rooms/components/MultiGuestView.tsx',
    must: [/live-chat-input|approved-live-chat-form|composer-bottom-inset/],
  },
];

for (const s of surfaces) {
  const src = read(s.file);
  for (const re of s.must) assert.match(src, re, `${s.id} missing ${re}`);
  console.log(`PASS ${s.id}`);
}
console.log('\nlive-keyboard static gates PASS');

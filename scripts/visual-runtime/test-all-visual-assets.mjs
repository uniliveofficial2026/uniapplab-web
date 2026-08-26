#!/usr/bin/env node
/** Fail if production-required visual packages are missing from public/. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(ROOT, 'artifacts/instacollab/public');

const required = [
  'live-tools-v14/gifts/lucky-bill.png',
  'live-tools-v14/beauty/natural.png',
  'live-tools-v14/stickers/hi.png',
  'live-gifts/approved-v12/UG-001_enchanted-rose.png',
  'live-gifts/star.svga',
  'brand/app-logo.png',
  'unilives-assets/brand/loading/princess-inapp-loading-locked.mp4',
  'unilives-assets/brand/loading/princess-inapp-loading-locked.jpg',
];

const missing = [];
const zero = [];
for (const rel of required) {
  const abs = path.join(PUBLIC, rel);
  if (!fs.existsSync(abs)) {
    missing.push(rel);
    continue;
  }
  if (fs.statSync(abs).size < 32) zero.push(rel);
}

if (missing.length || zero.length) {
  console.error(JSON.stringify({ ok: false, missing, zero }, null, 2));
  process.exit(1);
}

// Count package sizes
function count(dir) {
  const abs = path.join(PUBLIC, dir);
  if (!fs.existsSync(abs)) return 0;
  let n = 0;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else n += 1;
    }
  };
  walk(abs);
  return n;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      liveToolsV14Files: count('live-tools-v14'),
      approvedV12Files: count('live-gifts/approved-v12'),
      checked: required.length,
    },
    null,
    2,
  ),
);

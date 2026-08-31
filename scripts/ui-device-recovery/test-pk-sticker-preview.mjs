#!/usr/bin/env node
/**
 * PK sticker sheet cards must keep square previews (not flat cover crop).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const css = readFileSync(
  join(root, 'artifacts/instacollab/src/smule-rooms/components/live-tools-approved-v15.css'),
  'utf8',
);
const sheet = readFileSync(
  join(root, 'artifacts/instacollab/src/components/live/PkStickerSheet.tsx'),
  'utf8',
);

let fail = 0;
function ok(label) {
  console.log(`PASS ${label}`);
}
function bad(label) {
  console.error(`FAIL ${label}`);
  fail += 1;
}

if (!css.includes('.lt15-sticker-card') || !css.includes('aspect-ratio: 1 / 1')) {
  bad('sticker card square aspect');
} else ok('sticker card square aspect');

if (css.includes('grid-template-rows: repeat(4, minmax(0, 1fr))')) {
  bad('sticker grid still forces flat fr rows');
} else ok('sticker grid auto rows');

if (!css.includes('object-fit: contain')) bad('sticker object-fit contain');
else ok('sticker object-fit contain');

if (sheet.includes('object-cover')) bad('PkStickerSheet still forces object-cover');
else ok('PkStickerSheet no object-cover');

if (!sheet.includes('lt15-sticker-art')) bad('PkStickerSheet art class');
else ok('PkStickerSheet art class');

if (fail > 0) process.exit(1);
console.log('\nPK sticker preview gate: PASS');

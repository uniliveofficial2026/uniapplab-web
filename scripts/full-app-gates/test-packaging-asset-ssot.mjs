#!/usr/bin/env node
/**
 * Packaging SSOT gate: required product visual families must exist in deploy/spa-public.
 * Prevents shipping SPA without live-tools-v14 / approved-v12 / loading brand assets.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const spa = path.join(root, 'deploy/spa-public');

const REQUIRED_PATHS = [
  'brand/app-logo.png',
  'live-tools-v14',
  'live-gifts/approved-v12',
  'unilives-assets/brand/loading',
];

const REQUIRED_SAMPLES = [
  'live-tools-v14/gifts',
  'live-tools-v14/stickers',
  'live-tools-v14/beauty',
  'live-gifts/approved-v12',
];

function fail(msg) {
  console.error(`FAIL packaging-asset-ssot: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(spa, 'index.html'))) {
  fail('missing deploy/spa-public/index.html');
}

for (const rel of REQUIRED_PATHS) {
  const full = path.join(spa, rel);
  if (!fs.existsSync(full)) fail(`missing required path ${rel}`);
}

for (const rel of REQUIRED_SAMPLES) {
  const full = path.join(spa, rel);
  if (!fs.existsSync(full)) fail(`missing sample family ${rel}`);
  const entries = fs.readdirSync(full);
  if (entries.length < 1) fail(`empty family ${rel}`);
}

// Count PNGs under V14 gifts as a minimum ship signal
function countFiles(dir, ext = '.png') {
  let n = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) n += countFiles(p, ext);
    else if (name.toLowerCase().endsWith(ext)) n += 1;
  }
  return n;
}

const giftPngs = countFiles(path.join(spa, 'live-tools-v14/gifts'));
const approvedPngs = countFiles(path.join(spa, 'live-gifts/approved-v12'));
if (giftPngs < 10) fail(`live-tools-v14/gifts PNG count too low: ${giftPngs}`);
if (approvedPngs < 5) fail(`approved-v12 PNG count too low: ${approvedPngs}`);

console.log(
  JSON.stringify(
    {
      ok: true,
      giftPngs,
      approvedPngs,
      families: REQUIRED_PATHS,
    },
    null,
    2,
  ),
);

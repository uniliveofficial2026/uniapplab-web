#!/usr/bin/env node
/**
 * Greedy Tap must respect notch / Dynamic Island safe-area on iPhone.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const greedyPublic = join(root, 'artifacts/instacollab/public/games/greedy-slot');
const greedyOverlays = join(root, 'artifacts/instacollab/greedy-slot-overlays');
const ctx = join(root, 'artifacts/instacollab/src/contexts/GreedySessionContext.tsx');
const hostInsets = join(root, 'artifacts/instacollab/src/lib/greedyTap/hostInsets.ts');

let fail = 0;
function ok(label) {
  console.log(`PASS ${label}`);
}
function bad(label, detail = '') {
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
  fail += 1;
}

const indexHtml = readFileSync(join(greedyPublic, 'index.html'), 'utf8');
if (!indexHtml.includes('viewport-fit=cover')) bad('greedy index viewport-fit=cover');
else ok('greedy index viewport-fit=cover');

if (!indexHtml.includes('greedy-safe-area.css')) bad('greedy safe-area css linked');
else ok('greedy safe-area css linked');

if (!indexHtml.includes('greedy-host-insets.js')) bad('greedy host-insets boot linked');
else ok('greedy host-insets boot linked');

const safeCss = readFileSync(join(greedyPublic, 'greedy-safe-area.css'), 'utf8');
if (!safeCss.includes('--greedy-safe-top')) bad('greedy-safe-area.css vars');
else ok('greedy-safe-area.css vars');

if (!safeCss.includes('header.flex.shrink-0')) bad('greedy header override');
else ok('greedy header override');

const bundlePath = join(greedyPublic, 'assets/index-gmdZDsVP.js');
if (!existsSync(bundlePath)) bad('greedy bundle missing');
else {
  const bundle = readFileSync(bundlePath, 'utf8');
  if (bundle.includes('paddingTop:"8px"')) bad('greedy bundle still hardcodes paddingTop 8px');
  else ok('greedy bundle header inset patched');

  if (bundle.includes('top:"8px"')) bad('greedy bundle still hardcodes top 8px toast');
  else ok('greedy bundle toast inset patched');
}

const ctxSrc = readFileSync(ctx, 'utf8');
if (!ctxSrc.includes('postGreedyHostInsets')) bad('GreedySessionContext host insets');
else ok('GreedySessionContext host insets');

if (!ctxSrc.includes('request-host-insets')) bad('GreedySessionContext inset request handler');
else ok('GreedySessionContext inset request handler');

if (!ctxSrc.includes('hostPaddedTop')) bad('GreedySessionContext host padded insets');
else ok('GreedySessionContext host padded insets');

if (!ctxSrc.includes("paddingTop: 'var(--app-safe-top")) bad('fullscreen host safe padding');
else ok('fullscreen host safe padding');

if (ctxSrc.includes('top-3 z-[260]')) bad('admin workspace button still top-3');
else ok('admin workspace button uses safe top');

if (!existsSync(hostInsets)) bad('hostInsets helper missing');
else ok('hostInsets helper present');

const syncScript = readFileSync(
  join(root, 'artifacts/instacollab/scripts/sync-greedy-tap-static.mjs'),
  'utf8',
);
if (!syncScript.includes('applyGreedySafeAreaOverlays')) bad('sync-greedy-tap-static overlays');
else ok('sync-greedy-tap-static overlays');

if (!existsSync(join(greedyOverlays, 'greedy-safe-area.css'))) bad('greedy overlay source missing');
else ok('greedy overlay source present');

if (fail > 0) process.exit(1);
console.log(`\nGreedy safe-area gate: ${fail === 0 ? 'PASS' : 'FAIL'}`);

#!/usr/bin/env node
/**
 * Opening Greedy must wake / keep Render realtime warm in the background.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const keepAlive = join(root, 'artifacts/instacollab/src/lib/greedyTap/keepAlive.ts');
const ctx = join(root, 'artifacts/instacollab/src/contexts/GreedySessionContext.tsx');
const screen = join(root, 'artifacts/instacollab/src/components/games/GreedyTapScreen.tsx');
const config = join(root, 'artifacts/instacollab/src/lib/greedyTap/config.ts');

let fail = 0;
function ok(label) {
  console.log(`PASS ${label}`);
}
function bad(label, detail = '') {
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
  fail += 1;
}

if (!existsSync(keepAlive)) bad('keepAlive module missing');
else {
  const src = readFileSync(keepAlive, 'utf8');
  if (!src.includes('wakeGreedyRealtimeInBackground')) bad('wake helper');
  else ok('wake helper');
  if (!src.includes('startGreedyRealtimeKeepAlive')) bad('keepAlive helper');
  else ok('keepAlive helper');
  if (!src.includes('/games/greedy-slot/healthz')) bad('healthz wake path');
  else ok('healthz wake path');
}

const ctxSrc = readFileSync(ctx, 'utf8');
if (!ctxSrc.includes('startGreedyRealtimeKeepAlive')) bad('session starts keepAlive');
else ok('session starts keepAlive');
if (!ctxSrc.includes('wakeGreedyRealtimeInBackground')) bad('session wakes on open');
else ok('session wakes on open');

const screenSrc = readFileSync(screen, 'utf8');
if (!screenSrc.includes('wakeGreedyRealtimeInBackground')) bad('screen/prefetch wake');
else ok('screen/prefetch wake');

const configSrc = readFileSync(config, 'utf8');
if (!configSrc.includes('/games/greedy-slot/healthz')) bad('prod health url healthz');
else ok('prod health url healthz');
if (configSrc.includes("joinAppPath('/api/items')")) bad('prod health still /api/items');
else ok('prod health no longer /api/items');

if (fail > 0) process.exit(1);
console.log(`\nGreedy Render keep-alive gate: PASS`);

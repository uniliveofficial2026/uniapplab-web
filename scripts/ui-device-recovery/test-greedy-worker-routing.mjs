#!/usr/bin/env node
/**
 * Greedy static shell must be served from SPA_ORIGIN, not stale GAME_ORIGIN.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const worker = readFileSync(
  join(process.cwd(), 'workers/uniapplab-app/src/index.ts'),
  'utf8',
);

let fail = 0;
function ok(label) {
  console.log(`PASS ${label}`);
}
function bad(label, detail = '') {
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
  fail += 1;
}

if (!worker.includes('isGreedyTapStaticPath')) bad('greedy static path helper');
else ok('greedy static path helper');

if (!worker.includes('isGreedyTapStaticPath(path)')) bad('static path routes to SPA');
else ok('static path routes to SPA');

if (worker.includes('/games/greedy-slot") || path.startsWith("/socket.io")')) {
  bad('all greedy paths still go to GAME_ORIGIN');
} else ok('greedy no longer blanket-proxied to GAME');

if (!worker.includes('proxy(request, env.SPA_ORIGIN)')) bad('SPA_ORIGIN proxy present');
else ok('SPA_ORIGIN proxy present');

if (fail > 0) process.exit(1);
console.log(`\nGreedy worker routing gate: PASS`);

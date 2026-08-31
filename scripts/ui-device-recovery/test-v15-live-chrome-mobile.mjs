#!/usr/bin/env node
/**
 * V15 live chrome must compact on phone so top + body do not overlap.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(
  join(process.cwd(), 'artifacts/instacollab/src/smule-rooms/components/v15-live-room-chrome.css'),
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

if (!css.includes('@container approved-live-stage (max-width: 767px)')) bad('phone container compact');
else ok('phone container compact');

if (!css.includes('@media (max-width: 767px)')) bad('viewport mobile fallback');
else ok('viewport mobile fallback');

if (!css.includes('width: 36px') || !css.includes('height: 36px')) bad('compact avatar size');
else ok('compact avatar size');

if (css.includes('.v15-live-chrome__side { width: min(100%, 228px); }')) {
  bad('side still forced to 228px in narrow queries');
} else ok('side no longer forced 228px in narrow queries');

if (!css.includes('max-width: min(42%, 148px)')) bad('side max-width clamp');
else ok('side max-width clamp');

if (fail > 0) process.exit(1);
console.log('\nV15 live chrome mobile gate: PASS');

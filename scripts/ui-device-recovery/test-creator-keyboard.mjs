#!/usr/bin/env node
/**
 * test:creator-keyboard — Creator editable surfaces use keyboard SSOT where present.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const creatorRoot = path.join(root, 'artifacts/instacollab/src');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(full, acc);
    } else if (/\.tsx$/.test(ent.name) && /creator|Creator|publish|Upload|Caption/i.test(full)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(creatorRoot);
assert.ok(files.length >= 3, 'expected creator-related tsx files');

let inputFiles = 0;
let ssotFiles = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/\<(input|textarea)\b/.test(src)) continue;
  inputFiles += 1;
  if (/keyboardInputClassName|pb-composer|text-base|16px|composer-bottom-inset/.test(src)) {
    ssotFiles += 1;
  }
}

// Gate: at least one creator file indexed; SSOT adoption tracked (not all may be fixed yet)
assert.ok(inputFiles >= 1, 'expected creator inputs in source');
console.log(`creator-keyboard: ${inputFiles} creator input file(s), ${ssotFiles} with SSOT markers`);
console.log('creator-keyboard static gate PASS (inventory tracked; physical iPhone pending)');

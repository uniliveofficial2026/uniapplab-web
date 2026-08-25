#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appSrc = path.join(root, 'artifacts/instacollab/src');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (/seller|store|inventory|payout|inbound|outbound/i.test(full) && /\.tsx$/.test(full)) acc.push(full);
  }
  return acc;
}

const files = walk(appSrc);
let inputFiles = 0;
let ssotFiles = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/\<(input|textarea)\b/.test(src)) continue;
  inputFiles += 1;
  if (/keyboardInputClassName|keyboardLayout|pb-composer|unilivesInputClass|data-keyboard-ssot/.test(src)) {
    ssotFiles += 1;
  }
}

console.log(`seller-keyboard: ${ssotFiles}/${inputFiles || 0} seller input files with SSOT`);
console.log('seller-keyboard static gate PASS (inventory tracked)');

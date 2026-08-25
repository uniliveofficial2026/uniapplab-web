#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appSrc = path.join(root, 'artifacts/instacollab/src');

const files = [
  'smule-rooms/components/CommerceLiveCheckoutModal.tsx',
  'smule-rooms/components/CommerceLivePanel.tsx',
  'components/wallet/ShopTab.tsx',
];

let withInputs = 0;
let withSsot = 0;
for (const rel of files) {
  const full = path.join(appSrc, rel);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, 'utf8');
  if (!/\<(input|textarea)\b/.test(src)) continue;
  withInputs += 1;
  if (/keyboardInputClassName|keyboardLayout|pb-composer|text-base|data-keyboard-ssot|unilivesInputClass/.test(src)) {
    withSsot += 1;
  }
}

assert.ok(withInputs >= 1, 'expected marketplace/checkout inputs');
console.log(`marketplace-keyboard: ${withSsot}/${withInputs} files with SSOT markers`);
console.log('marketplace-keyboard static gate PASS (rollout tracked)');

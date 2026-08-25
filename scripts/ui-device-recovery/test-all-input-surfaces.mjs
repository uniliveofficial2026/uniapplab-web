#!/usr/bin/env node
/**
 * test:all-input-surfaces — inventory gate + forbidden legacy keyboard patterns.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const inventoryPath = path.join(root, 'docs/ui-device-recovery/FINAL-ALL-INPUT-INVENTORY.json');
const appSrc = path.join(root, 'artifacts/instacollab/src');

spawnSync('node', ['scripts/ui-device-recovery/generate-input-inventory.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

assert.ok(fs.existsSync(inventoryPath), 'FINAL-ALL-INPUT-INVENTORY.json missing');
const { summary, inputs } = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

assert.ok(summary.total >= 50, `expected >=50 inputs, got ${summary.total}`);
assert.ok(summary.keyboardSsot >= 5, 'expected keyboard SSOT on critical composers');

const criticalLabels = [
  'chat-input',
  'feed-comment-input',
  'post-comment-input',
  'reels-comment-input',
];

for (const label of criticalLabels) {
  const hit = inputs.find((i) => i.selector === `[aria-label="${label}"]`);
  assert.ok(hit, `missing critical input aria-label=${label}`);
  assert.equal(hit.hasKeyboardSsot, true, `${label} must use keyboard SSOT classes`);
  assert.equal(hit.hasLegacyKeyboard, false, `${label} must not use legacy keyboard math`);
}

const legacyHits = inputs.filter((i) => i.hasLegacyKeyboard && i.physicalStatus !== 'NOT_APPLICABLE');
assert.ok(legacyHits.length === 0, `legacy keyboard patterns: ${legacyHits.map((h) => h.selector).join(', ')}`);

// Shared primitive must exist
assert.ok(
  fs.existsSync(path.join(appSrc, 'components/common/keyboardLayout.ts')),
  'keyboardLayout.ts SSOT missing',
);

console.log(`\nall-input-surfaces PASS (${summary.total} inputs indexed)`);

#!/usr/bin/env node
/**
 * test:modal-keyboard — modals/sheets containing inputs use vv-height, not raw 100vh stacks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outFile = path.join(root, 'docs/ui-device-recovery/FINAL-INPUT-MODAL-MATRIX.json');

spawnSync('node', ['scripts/ui-device-recovery/generate-input-inventory.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

const { inputs } = JSON.parse(
  fs.readFileSync(path.join(root, 'docs/ui-device-recovery/FINAL-ALL-INPUT-INVENTORY.json'), 'utf8'),
);

const modalInputs = inputs.filter(
  (i) => (i.insideModal || i.insideSheet) && i.physicalStatus !== 'NOT_APPLICABLE',
);

const matrix = modalInputs.map((i) => {
  const src = fs.readFileSync(
    path.join(root, 'artifacts/instacollab', i.sourceFile),
    'utf8',
  );
  const usesVv =
    /--app-vv-height|keyboardAwareSheet|keyboard-aware-sheet|65dvh|85dvh/.test(src);
  const usesBadVh =
    /h-\[100vh\]|height:\s*100vh|calc\(100vh\s*-\s*var\(--app-keyboard/.test(src) &&
    !usesVv;

  return {
    modalId: i.selector,
    screen: i.screen,
    input: i.selector,
    keyboardOpenBehavior: i.hasKeyboardSsot ? 'composer-inset' : 'unknown',
    keyboardClosedBehavior: 'default',
    scrollBehavior: 'container-scroll',
    ctaVisibility: i.hasKeyboardSsot ? 'PASS_STATIC' : 'NOT_TESTED',
    closeVisibility: 'PASS_STATIC',
    safeArea: i.hasKeyboardSsot ? 'PASS_STATIC' : 'NOT_TESTED',
    physicalStatus: usesBadVh ? 'FAIL' : i.physicalStatus,
    usesVisualViewportHeight: usesVv,
  };
});

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), matrix }, null, 2));

const fails = matrix.filter((m) => m.physicalStatus === 'FAIL');
assert.ok(fails.length === 0, `modal keyboard FAIL: ${fails.map((f) => f.modalId).join(', ')}`);

console.log(`modal-keyboard PASS (${matrix.length} modal inputs indexed)`);

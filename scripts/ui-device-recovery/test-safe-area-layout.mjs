#!/usr/bin/env node
/**
 * test:safe-area-layout — CSS token + shell chrome wiring for safe areas.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(__dirname, '../../artifacts/instacollab');

function read(rel) {
  return fs.readFileSync(path.join(app, rel), 'utf8');
}

const css = read('src/index.css');
for (const token of [
  '--app-safe-top',
  '--app-safe-bottom',
  '--app-safe-left',
  '--app-safe-right',
  '--app-shell-bottom-offset',
  '--app-vv-height',
  '--app-vv-width',
  '--app-layout-vv-width',
  '--app-layout-vv-height',
  '--app-keyboard-inset',
  '--app-composer-bottom-inset',
]) {
  assert.ok(css.includes(token), `missing token ${token}`);
}

assert.match(css, /\.pt-safe|\.pb-safe|pt-safe/);
assert.match(css, /\.pb-shell-nav/);
assert.match(css, /\.mobile-bottom-nav/);
assert.match(css, /padding-bottom:\s*var\(--app-safe-bottom\)/);

const shell = read('src/components/layout/Shell.tsx');
assert.match(shell, /pb-shell-nav|app-safe-bottom|h-vv/);

assert.ok(
  !/padding-bottom:\s*34px/.test(css) && !/padding-top:\s*47px/.test(css),
  'CSS must not hardcode iPhone notch/home-indicator pixels',
);

console.log(JSON.stringify({ ok: true, safeAreaTokens: 'PASS_STATIC' }, null, 2));

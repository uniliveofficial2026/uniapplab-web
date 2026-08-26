#!/usr/bin/env node
/** Aggregator for global visual runtime gates. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const steps = [
  ['generate', 'node', ['scripts/visual-runtime/generate-inventories.mjs']],
  ['all-visual-assets', 'node', ['scripts/visual-runtime/test-all-visual-assets.mjs']],
  ['asset-url-resolution', 'node', ['scripts/visual-runtime/test-asset-url-resolution.mjs']],
  ['dynamic-media-url', 'node', ['scripts/visual-runtime/test-dynamic-media-url.mjs']],
  ['animation-runtime', 'node', ['scripts/visual-runtime/test-animation-runtime.mjs']],
  ['ios-animation-contracts', 'node', ['scripts/visual-runtime/test-ios-animation-contracts.mjs']],
  ['image-decode', 'node', ['scripts/visual-runtime/test-image-decode.mjs']],
  ['asset-cache-integrity', 'node', ['scripts/visual-runtime/test-asset-cache-integrity.mjs']],
];

// production-assets is optional until deploy lands (set REQUIRE_PROD=1 to enforce)
if (process.env.REQUIRE_PROD === '1') {
  steps.push(['production-assets', 'node', ['scripts/visual-runtime/test-production-assets.mjs']]);
}

const results = [];
for (const [name, cmd, args] of steps) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', env: process.env });
  results.push({
    name,
    code: r.status,
    out: (r.stdout || '').trim().slice(0, 400),
    err: (r.stderr || '').trim().slice(0, 400),
  });
  if (r.status !== 0) {
    console.error(JSON.stringify({ ok: false, failed: name, results }, null, 2));
    process.exit(r.status || 1);
  }
}
console.log(JSON.stringify({ ok: true, results }, null, 2));

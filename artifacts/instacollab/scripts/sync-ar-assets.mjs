#!/usr/bin/env node
/**
 * First-install AR packages (DeepAR + TRTC/WebAR). Subsequent runs use local cache markers.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

function run(script) {
  const result = spawnSync('node', [path.join(scriptsDir, script)], { stdio: 'inherit' });
  return result.status ?? 1;
}

console.log('[ar] Syncing DeepAR + TRTC WebAR assets (cached after first install)…');

const deepar = run('sync-deepar-assets.mjs');
if (deepar !== 0) {
  console.warn('[ar] DeepAR sync reported errors — continuing with TRTC install');
}

const trtc = run('install-trtc-webar-assets.mjs');
if (trtc !== 0) {
  console.warn('[ar] TRTC WebAR install reported errors');
  process.exit(trtc);
}

console.log('[ar] Asset sync complete');

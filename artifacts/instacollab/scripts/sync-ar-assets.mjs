#!/usr/bin/env node
/**
 * First-install AR packages (DeepAR + TRTC/WebAR). Subsequent runs use local cache markers.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDeeparEnabled } from './read-deepar-enabled.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptsDir, '..');

function run(script) {
  const result = spawnSync('node', [path.join(scriptsDir, script)], { stdio: 'inherit' });
  return result.status ?? 1;
}

const deeparEnabled = readDeeparEnabled(appRoot);

console.log('[ar] Syncing TRTC WebAR assets…');
if (deeparEnabled) {
  console.log('[ar] DeepAR enabled — syncing DeepAR SDK + effects…');
  const deepar = run('sync-deepar-assets.mjs');
  if (deepar !== 0) {
    console.warn('[ar] DeepAR sync reported errors — continuing with TRTC install');
  }
} else {
  console.log('[ar] DeepAR disabled (DEEPAR_ENABLED=false) — skipping DeepAR asset sync');
}

const trtc = run('install-trtc-webar-assets.mjs');
if (trtc !== 0) {
  console.warn('[ar] TRTC WebAR install reported errors');
  process.exit(trtc);
}

console.log('[ar] Asset sync complete');

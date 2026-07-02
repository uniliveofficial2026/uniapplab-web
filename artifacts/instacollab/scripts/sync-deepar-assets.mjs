#!/usr/bin/env node
/** Prepare DeepAR SDK + free filters for dev/build. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

const install = spawnSync('node', [path.join(scriptsDir, 'install-deepar-assets.mjs')], {
  stdio: 'inherit',
});

if (install.status !== 0) {
  console.warn('[deepar] Zip install failed — falling back to npm SDK copy + quickstart effects');
  for (const script of ['copy-deepar-resources.mjs', 'sync-deepar-effects.mjs']) {
    const result = spawnSync('node', [path.join(scriptsDir, script)], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

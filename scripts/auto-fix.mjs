#!/usr/bin/env node
/**
 * Auto-fix common issues across the entire app before deploy.
 * Usage: pnpm run fix
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: opts.cwd ?? ROOT, stdio: 'inherit' });
  return r.status ?? 1;
}

console.log('[fix] Running full self-heal pipeline…');
process.exit(run('node', ['scripts/self-heal.mjs']));

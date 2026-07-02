#!/usr/bin/env node
/**
 * Push VITE_DEEPAR_LICENSE_KEY from local .env to Vercel (Production + Preview).
 * Required for AR to work after deploy — Vite bakes VITE_* at build time.
 *
 * Usage: pnpm --filter @workspace/instacollab run deepar:env-vercel
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readMergedEnv, getAppRoot, getWorkspaceRoot } from './resolveProjectEnv.mjs';

const merged = readMergedEnv(import.meta.dirname);
const key = (merged.VITE_DEEPAR_LICENSE_KEY ?? '').trim();

if (!key || /your|xxxx|placeholder/i.test(key)) {
  console.error('[deepar] VITE_DEEPAR_LICENSE_KEY missing in .env — set it first.');
  process.exit(1);
}

const appRoot = getAppRoot(import.meta.dirname);
const repoRoot = getWorkspaceRoot(appRoot);
const projectFile = path.join(repoRoot, '.vercel', 'project.json');

function vercelEnv(cmdArgs) {
  return spawnSync('pnpm', ['dlx', 'vercel@latest', 'env', ...cmdArgs], {
    cwd: repoRoot,
    input: key,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: {
      ...process.env,
      NPM_CONFIG_USERCONFIG: undefined,
      NPM_CONFIG_GLOBALCONFIG: undefined,
    },
  });
}

console.log('[deepar] Syncing VITE_DEEPAR_LICENSE_KEY to Vercel…');

for (const target of ['production', 'preview', 'development']) {
  // Remove old value if present (ignore errors).
  spawnSync(
    'pnpm',
    ['dlx', 'vercel@latest', 'env', 'rm', 'VITE_DEEPAR_LICENSE_KEY', target, '--yes'],
    { cwd: repoRoot, stdio: 'ignore' },
  );
  const add = vercelEnv(['add', 'VITE_DEEPAR_LICENSE_KEY', target, '--yes', '--force']);
  if (add.status !== 0) {
    console.error(`[deepar] Failed to set Vercel env for ${target}`);
    process.exit(add.status ?? 1);
  }
  console.log(`[deepar] ✓ ${target}`);
}

console.log('');
console.log('[deepar] Done. Redeploy for AR to activate on app.uniapplab.com:');
console.log('  pnpm run deploy:vercel');

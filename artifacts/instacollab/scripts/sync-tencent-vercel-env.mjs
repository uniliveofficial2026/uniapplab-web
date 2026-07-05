#!/usr/bin/env node
/**
 * Push Tencent WebAR VITE_* keys from local .env to Vercel (Production + Preview).
 * Required for TRTC beauty filters in live / karaoke / party rooms.
 *
 * Usage: pnpm --filter @workspace/instacollab run tencent:env-vercel
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readMergedEnv, getAppRoot, getWorkspaceRoot } from './resolveProjectEnv.mjs';

const merged = readMergedEnv(import.meta.dirname);
const keys = [
  ['VITE_TENCENT_WEBAR_APP_ID', (merged.VITE_TENCENT_WEBAR_APP_ID ?? '').trim()],
  ['VITE_TENCENT_WEBAR_LICENSE_KEY', (merged.VITE_TENCENT_WEBAR_LICENSE_KEY ?? '').trim()],
  ['VITE_TENCENT_WEBAR_TOKEN', (merged.VITE_TENCENT_WEBAR_TOKEN ?? '').trim()],
];

const missing = keys.filter(([, value]) => !value).map(([name]) => name);
if (missing.length) {
  console.error('[tencent] Missing in .env:', missing.join(', '));
  process.exit(1);
}

const appRoot = getAppRoot(import.meta.dirname);
const repoRoot = getWorkspaceRoot(appRoot);
const projectFile = path.join(repoRoot, '.vercel', 'project.json');

function vercelEnv(name, value, cmdArgs) {
  return spawnSync('pnpm', ['dlx', 'vercel@latest', 'env', ...cmdArgs], {
    cwd: repoRoot,
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: {
      ...process.env,
      NPM_CONFIG_USERCONFIG: undefined,
      NPM_CONFIG_GLOBALCONFIG: undefined,
    },
  });
}

console.log('[tencent] Syncing Tencent WebAR env to Vercel…');

for (const target of ['production', 'preview', 'development']) {
  for (const [name, value] of keys) {
    spawnSync('pnpm', ['dlx', 'vercel@latest', 'env', 'rm', name, target, '--yes'], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    const add = vercelEnv(name, value, ['add', name, target, '--yes', '--force']);
    if (add.status !== 0) {
      console.error(`[tencent] Failed to set ${name} for ${target}`);
      process.exit(add.status ?? 1);
    }
    console.log(`[tencent] ✓ ${name} → ${target}`);
  }
}

console.log('');
console.log('[tencent] Done. Redeploy for TRTC beauty on app.uniapplab.com:');
console.log('  pnpm run deploy:vercel');

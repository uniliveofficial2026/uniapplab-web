#!/usr/bin/env node
/**
 * Fix production /api/* 404 — sync Vercel to subfolder + API staging, optional deploy.
 * Usage:
 *   pnpm run vercel:fix-root              # settings only
 *   pnpm run vercel:fix-root -- --git     # settings + git deploy
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readVercelToken } from './lib/vercel-token.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => a !== '--');
const wantGit = args.includes('--git');
const wantDeploy = args.includes('--deploy');

function run(script) {
  const token = readVercelToken();
  const r = spawnSync('node', [script], {
    cwd: ROOT,
    stdio: 'inherit',
    env: token ? { ...process.env, VERCEL_TOKEN: token } : process.env,
  });
  return r.status ?? 1;
}

const settingsStatus = run('scripts/sync-vercel-project-settings.mjs');
if (settingsStatus !== 0) process.exit(settingsStatus);

if (wantGit) {
  process.exit(run('scripts/vercel-redeploy-git.mjs'));
}
if (wantDeploy) {
  const r = spawnSync('bash', ['scripts/vercel-deploy-api.sh'], { cwd: ROOT, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

console.log('[vercel] Settings OK. Deploy when quota allows: pnpm run vercel:redeploy-git');

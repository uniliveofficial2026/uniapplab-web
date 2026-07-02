#!/usr/bin/env node
/**
 * Push LiveKit env to Vercel (Production + Preview + Development).
 * Usage: pnpm run livekit:env-vercel
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMergedEnv, getWorkspaceRoot, getAppRoot } from './resolveProjectEnv.mjs';

const fromDir = import.meta.dirname;
const merged = readMergedEnv(fromDir);
const appRoot = getAppRoot(fromDir);
const repoRoot = getWorkspaceRoot(appRoot);

const wssUrl = (merged.LIVEKIT_URL || merged.VITE_LIVEKIT_URL || '').trim();

const VARS = [
  ['LIVEKIT_API_KEY', merged.LIVEKIT_API_KEY],
  ['LIVEKIT_API_SECRET', merged.LIVEKIT_API_SECRET],
  ['LIVEKIT_URL', wssUrl],
  ['VITE_LIVEKIT_URL', wssUrl],
];

const missing = VARS.filter(([name, value]) => {
  if (name === 'LIVEKIT_URL' || name === 'VITE_LIVEKIT_URL') {
    return !value || !/^wss:\/\//i.test(value);
  }
  return !value || /your|xxxx|placeholder/i.test(value);
});

if (missing.length) {
  console.error('[livekit] Missing required env:');
  for (const [name] of missing) console.error(`  - ${name}`);
  console.error('Run: pnpm --filter @workspace/instacollab run livekit:setup');
  process.exit(1);
}

function vercelEnvSet(name, value, target) {
  spawnSync('pnpm', ['dlx', 'vercel@latest', 'env', 'rm', name, target, '--yes'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  const addArgs = ['dlx', 'vercel@latest', 'env', 'add', name, target, '--yes', '--force'];
  if (target === 'preview') {
    addArgs.push('--git-branch', '*');
  }
  const add = spawnSync('pnpm', addArgs, {
    cwd: repoRoot,
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: {
      ...process.env,
      NPM_CONFIG_USERCONFIG: undefined,
      NPM_CONFIG_GLOBALCONFIG: undefined,
    },
  });
  return add.status ?? 1;
}

console.log('[livekit] Syncing LiveKit env to Vercel…');

for (const target of ['production', 'preview', 'development']) {
  for (const [name, value] of VARS) {
    if (!value) continue;
    const code = vercelEnvSet(name, value, target);
    if (code !== 0) {
      console.error(`[livekit] Failed ${name} (${target})`);
      process.exit(code);
    }
    console.log(`[livekit] ✓ ${name} → ${target}`);
  }
}

console.log('');
console.log('[livekit] Done. Redeploy for live streaming: pnpm run deploy:vercel');

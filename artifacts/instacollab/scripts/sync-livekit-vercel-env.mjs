#!/usr/bin/env node
/**
 * Push LiveKit env to Vercel (Production + Preview + Development).
 * Usage: pnpm run livekit:env-vercel
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMergedEnv, getWorkspaceRoot, getAppRoot } from './resolveProjectEnv.mjs';
import { vercelEnvSyncAll } from '../../../scripts/lib/vercel-env.mjs';

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

console.log('[livekit] Syncing LiveKit env to Vercel…');

const code = vercelEnvSyncAll(repoRoot, VARS, { label: 'livekit' });
if (code !== 0) process.exit(code);

console.log('');
console.log('[livekit] Done. Redeploy for live streaming: pnpm run deploy:vercel:git');

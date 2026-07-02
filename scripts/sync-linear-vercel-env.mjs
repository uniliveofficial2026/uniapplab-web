#!/usr/bin/env node
/**
 * Push Linear env to Vercel (Production + Preview + Development).
 * Usage: pnpm run linear:env-vercel
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vercelEnvSyncAll } from './lib/vercel-env.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnv() {
  const out = {};
  for (const file of [
    path.join(ROOT, '.env'),
    path.join(ROOT, '.env.local'),
    path.join(ROOT, 'artifacts/instacollab/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return { ...out, ...process.env };
}

const env = readEnv();

const VARS = [
  ['LINEAR_API_KEY', env.LINEAR_API_KEY],
  ['LINEAR_TEAM_ID', env.LINEAR_TEAM_ID],
  ['LINEAR_WEBHOOK_SECRET', env.LINEAR_WEBHOOK_SECRET],
];

if (!env.LINEAR_API_KEY) {
  console.error('[linear] LINEAR_API_KEY missing — run: pnpm run linear:setup');
  process.exit(1);
}

const code = vercelEnvSyncAll(ROOT, VARS, { label: 'linear' });
if (code !== 0) process.exit(code);

console.log('[linear] Vercel env sync complete');

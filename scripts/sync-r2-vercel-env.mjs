#!/usr/bin/env node
/**
 * Push object-storage (R2_*) env to Vercel Production + Preview + Development.
 * Usage: node scripts/sync-r2-vercel-env.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const merged = {
  ...parseEnvFile(path.join(ROOT, '.env')),
  ...parseEnvFile(path.join(ROOT, 'artifacts/api-server/.env')),
};

const NAMES = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_REGION',
  'R2_FORCE_PATH_STYLE',
  'R2_PUBLIC_BASE_URL',
  'R2_ACCOUNT_ID',
];

const vars = NAMES.map((name) => [name, merged[name]]).filter(([, v]) => Boolean(v));

if (!merged.R2_ACCESS_KEY_ID || !merged.R2_SECRET_ACCESS_KEY || !merged.R2_BUCKET) {
  console.error('[r2] Missing R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET in .env');
  process.exit(1);
}
if (!merged.R2_ENDPOINT && !merged.R2_ACCOUNT_ID) {
  console.error('[r2] Missing R2_ENDPOINT or R2_ACCOUNT_ID in .env');
  process.exit(1);
}
if (!merged.R2_PUBLIC_BASE_URL) {
  console.error('[r2] Missing R2_PUBLIC_BASE_URL in .env');
  process.exit(1);
}

function vercelEnvSet(name, value, target) {
  spawnSync('pnpm', ['dlx', 'vercel@latest', 'env', 'rm', name, target, '--yes'], {
    cwd: ROOT,
    stdio: 'ignore',
    env: process.env,
  });
  const add = spawnSync(
    'pnpm',
    ['dlx', 'vercel@latest', 'env', 'add', name, target, '--yes', '--force'],
    {
      cwd: ROOT,
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: process.env,
    },
  );
  return add.status ?? 1;
}

console.log('[r2] Syncing object-storage env to Vercel…');
for (const target of ['production', 'preview', 'development']) {
  for (const [name, value] of vars) {
    const code = vercelEnvSet(name, value, target);
    if (code !== 0) {
      console.error(`[r2] Failed ${name} (${target})`);
      process.exit(code);
    }
    console.log(`[r2] ✓ ${name} → ${target}`);
  }
}
console.log('[r2] Done. Redeploy so production picks up the vars.');

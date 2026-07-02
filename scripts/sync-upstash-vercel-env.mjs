#!/usr/bin/env node
/**
 * Push Upstash / QStash / API Supabase env to Vercel (Production + Preview + Development).
 * Usage: pnpm run upstash:env-vercel
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  ['UPSTASH_REDIS_REST_URL', env.UPSTASH_REDIS_REST_URL],
  ['UPSTASH_REDIS_REST_TOKEN', env.UPSTASH_REDIS_REST_TOKEN],
  ['QSTASH_TOKEN', env.QSTASH_TOKEN],
  ['QSTASH_CURRENT_SIGNING_KEY', env.QSTASH_CURRENT_SIGNING_KEY],
  ['QSTASH_NEXT_SIGNING_KEY', env.QSTASH_NEXT_SIGNING_KEY],
  ['PUBLIC_APP_ORIGIN', env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com'],
  ['SUPABASE_URL', env.SUPABASE_URL || env.VITE_SUPABASE_URL],
  ['SUPABASE_ANON_KEY', env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY],
  ['SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY],
];

const missing = VARS.filter(([name, value]) => {
  if (name.startsWith('QSTASH_') && name !== 'QSTASH_CURRENT_SIGNING_KEY') return false;
  if (name === 'QSTASH_NEXT_SIGNING_KEY') return false;
  if (name === 'SUPABASE_SERVICE_ROLE_KEY') return false;
  return !value || /your|xxxx|placeholder/i.test(value);
});

if (missing.length) {
  console.error('[upstash] Missing required env:');
  for (const [name] of missing) console.error(`  - ${name}`);
  console.error('Run: pnpm run upstash:setup');
  process.exit(1);
}

function vercelEnvSet(name, value, target) {
  spawnSync('pnpm', ['dlx', 'vercel@latest', 'env', 'rm', name, target, '--yes'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const addArgs = ['dlx', 'vercel@latest', 'env', 'add', name, target, '--yes', '--force'];
  if (target === 'preview') {
    addArgs.push('--git-branch', '*');
  }
  const add = spawnSync('pnpm', addArgs, {
    cwd: ROOT,
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

console.log('[upstash] Syncing server env to Vercel…');

for (const target of ['production', 'preview', 'development']) {
  for (const [name, value] of VARS) {
    if (!value) continue;
    const code = vercelEnvSet(name, value, target);
    if (code !== 0) {
      console.error(`[upstash] Failed ${name} (${target})`);
      process.exit(code);
    }
    console.log(`[upstash] ✓ ${name} → ${target}`);
  }
}

console.log('');
console.log('[upstash] Done. Redeploy: pnpm run deploy:vercel');

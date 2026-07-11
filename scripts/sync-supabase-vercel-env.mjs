#!/usr/bin/env node
/**
 * Push Supabase client + server env to Vercel (Production + Preview + Development).
 * Usage: node scripts/sync-supabase-vercel-env.mjs
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
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const anon =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KET;

const VARS = [
  ['VITE_SUPABASE_URL', supabaseUrl],
  ['VITE_SUPABASE_ANON_KEY', anon],
  ['VITE_SUPABASE_PUBLISHABLE_KEY', env.VITE_SUPABASE_PUBLISHABLE_KEY || anon],
  ['SUPABASE_URL', supabaseUrl],
  ['SUPABASE_ANON_KEY', anon],
  ['SUPABASE_SERVICE_ROLE_KEY', service],
];

const missing = VARS.filter(([name, value]) => {
  if (name === 'SUPABASE_SERVICE_ROLE_KEY') return false;
  return !value || /your|xxxx|placeholder|otiqckextvdbudbxzmau/i.test(value);
});

if (missing.length) {
  console.error('[supabase] Missing required env:');
  for (const [name] of missing) console.error(`  - ${name}`);
  process.exit(1);
}

if (!service) {
  console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY missing — API wallet/gift routes will fail.');
}

console.log('[supabase] Syncing env to Vercel for project', supabaseUrl);
const code = vercelEnvSyncAll(ROOT, VARS, { label: 'supabase' });
if (code !== 0) process.exit(code);
console.log('[supabase] Done. Redeploy production to pick up client keys.');

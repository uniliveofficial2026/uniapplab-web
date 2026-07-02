#!/usr/bin/env node
/**
 * Push API env from .env to Fly.io secrets.
 * Usage: pnpm run fly:env-secrets
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
const flyApp = env.FLY_APP_NAME || 'uniapplab-api';

const SECRETS = [
  ['SUPABASE_URL', env.SUPABASE_URL || env.VITE_SUPABASE_URL],
  ['SUPABASE_ANON_KEY', env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY],
  ['SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY],
  ['UPSTASH_REDIS_REST_URL', env.UPSTASH_REDIS_REST_URL],
  ['UPSTASH_REDIS_REST_TOKEN', env.UPSTASH_REDIS_REST_TOKEN],
  ['QSTASH_TOKEN', env.QSTASH_TOKEN],
  ['QSTASH_CURRENT_SIGNING_KEY', env.QSTASH_CURRENT_SIGNING_KEY],
  ['QSTASH_NEXT_SIGNING_KEY', env.QSTASH_NEXT_SIGNING_KEY],
  ['LIVEKIT_URL', env.LIVEKIT_URL],
  ['LIVEKIT_API_KEY', env.LIVEKIT_API_KEY],
  ['LIVEKIT_API_SECRET', env.LIVEKIT_API_SECRET],
  ['LINEAR_API_KEY', env.LINEAR_API_KEY],
  ['LINEAR_TEAM_ID', env.LINEAR_TEAM_ID],
  ['LINEAR_WEBHOOK_SECRET', env.LINEAR_WEBHOOK_SECRET],
  ['PUBLIC_APP_ORIGIN', env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com'],
  [
    'CORS_ORIGINS',
    env.CORS_ORIGINS ||
      'https://app.uniapplab.com,https://uniapplab.com,https://www.uniapplab.com,http://localhost:5173',
  ],
];

const required = SECRETS.filter(([name, value]) => {
  if (name === 'SUPABASE_SERVICE_ROLE_KEY') return false;
  if (name === 'LINEAR_TEAM_ID' || name === 'LINEAR_WEBHOOK_SECRET') return false;
  if (name.startsWith('QSTASH_') && name !== 'QSTASH_TOKEN') return false;
  return !value;
});

if (required.length) {
  console.error('[fly] Missing required env:');
  for (const [name] of required) console.error(`  - ${name}`);
  console.error('Run: pnpm run fly:setup');
  process.exit(1);
}

const pairs = SECRETS.filter(([, value]) => value).map(([name, value]) => `${name}=${value}`);
const importBody = pairs.join('\n');

const fly = spawnSync('fly', ['secrets', 'import', '-a', flyApp], {
  cwd: ROOT,
  input: importBody,
  stdio: ['pipe', 'inherit', 'inherit'],
});

if (fly.status !== 0) {
  console.error('');
  console.error('[fly] secrets import failed — install flyctl and run: fly auth login');
  process.exit(fly.status ?? 1);
}

console.log(`[fly] ✓ secrets synced to app ${flyApp} (${pairs.length} keys)`);

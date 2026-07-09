#!/usr/bin/env node
/**
 * Print Upstash + QStash setup steps for InstaCollab.
 * Usage: pnpm run upstash:setup
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = [path.join(ROOT, '.env'), path.join(ROOT, 'artifacts/instacollab/.env')].find((p) =>
  fs.existsSync(p),
);

function readEnv() {
  const out = {};
  if (!envPath) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = readEnv();
const origin = (env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');

console.log('');
console.log('=== Upstash full setup (InstaCollab) ===');
console.log('');
console.log('1) Create a Redis database at https://console.upstash.com/redis');
console.log('   → REST API → copy URL + token into root .env:');
console.log('');
console.log('   UPSTASH_REDIS_REST_URL=https://….upstash.io');
console.log('   UPSTASH_REDIS_REST_TOKEN=…');
console.log('');
console.log('2) Enable QStash at https://console.upstash.com/qstash');
console.log('   → Signing keys + token into .env:');
console.log('');
console.log('   QSTASH_TOKEN=…');
console.log('   QSTASH_CURRENT_SIGNING_KEY=…');
console.log('   QSTASH_NEXT_SIGNING_KEY=…');
console.log('');
console.log('3) API origin (for QStash webhook verification):');
console.log(`   PUBLIC_APP_ORIGIN=${origin}`);
console.log('');
console.log('4) Map Supabase for api-server on Vercel (if not already):');
console.log('   SUPABASE_URL=<same as VITE_SUPABASE_URL>');
console.log('   SUPABASE_ANON_KEY=<same as VITE_SUPABASE_ANON_KEY>');
console.log('   SUPABASE_SERVICE_ROLE_KEY=<service role — server only>');
console.log('');
console.log('5) Sync to Vercel + verify:');
console.log('   pnpm run upstash:env-vercel');
console.log('   pnpm run upstash:check');
console.log('   pnpm run upstash:schedule   # optional 10-min handoff cron');
console.log('   pnpm run deploy:vercel');
console.log('');
console.log('Endpoints after deploy:');
console.log(`  GET  ${origin}/api/upstash/health`);
console.log(`  GET  ${origin}/api/feed/posts`);
console.log(`  POST ${origin}/api/qstash/handoff-cycle  (QStash only)`);
console.log('');
if (env.UPSTASH_REDIS_REST_URL) {
  console.log(`✓ UPSTASH_REDIS_REST_URL present in ${envPath}`);
} else {
  console.log(`⚠ Add UPSTASH_* keys to ${envPath || 'repo root .env'}`);
}
console.log('');

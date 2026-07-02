#!/usr/bin/env node
/**
 * Fly.io setup guide for InstaCollab API.
 * Usage: pnpm run fly:setup
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'uniliveofficial2026/uniapplab-web';

function readEnv() {
  const out = {};
  for (const file of [path.join(ROOT, '.env'), path.join(ROOT, 'artifacts/instacollab/.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const env = readEnv();
const appOrigin = (env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
const flyApp = env.FLY_APP_NAME || 'uniapplab-api';

console.log('');
console.log('=== Fly.io setup (InstaCollab API) ===');
console.log('');
console.log('Fly hosts the always-on Node API (alternative/complement to Vercel /api/*).');
console.log('Handoff cron stays on QStash → Vercel or Fly API.');
console.log('');
console.log('1) Install Fly CLI');
console.log('   macOS:  brew install flyctl');
console.log('   other:  curl -L https://fly.io/install.sh | sh');
console.log('');
console.log('2) Login + create app (first time only)');
console.log('   fly auth login');
console.log(`   fly apps create ${flyApp} --org personal   # or your org slug`);
console.log('');
console.log('3) Add secrets from local .env');
console.log('   pnpm run fly:env-secrets');
console.log('');
console.log('   Required keys (same as Vercel api-server):');
console.log('   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
console.log('   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN');
console.log('   QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY');
console.log('   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET');
console.log('   LINEAR_API_KEY, LINEAR_TEAM_ID (optional webhook secret)');
console.log('   PUBLIC_APP_ORIGIN, CORS_ORIGINS');
console.log('');
console.log('4) Deploy');
console.log('   pnpm run fly:deploy');
console.log('');
console.log('5) Custom domain (recommended: api.uniapplab.com)');
console.log(`   fly certs add api.uniapplab.com -a ${flyApp}`);
console.log('   Cloudflare DNS: CNAME api → <fly-app>.fly.dev (proxy off for TLS)');
console.log('');
console.log('6) Verify');
console.log('   pnpm run fly:check');
console.log(`   curl https://${flyApp}.fly.dev/api/healthz`);
console.log(`   curl https://${flyApp}.fly.dev/api/linear/health`);
console.log('');
console.log('Routing options:');
console.log(`  A) Keep SPA on ${appOrigin} (Vercel) + API on Fly (api.uniapplab.com)`);
console.log('  B) Fly as failover only — Cloudflare health-checked origin pool');
console.log('');
console.log('Config files: fly.toml, Dockerfile.fly');
if (fs.existsSync(path.join(ROOT, 'fly.toml'))) {
  console.log('✓ fly.toml present');
} else {
  console.log('⚠ fly.toml missing');
}
console.log('');

#!/usr/bin/env node
/**
 * Linear setup guide — issue tracking + handoff escalation.
 * Usage: pnpm run linear:setup
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
const origin = (env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
const flyApp = env.FLY_APP_NAME || 'uniapplab-api';
const flyOrigin = env.FLY_API_ORIGIN || `https://${flyApp}.fly.dev`;

console.log('');
console.log('=== Linear setup (InstaCollab) ===');
console.log('');
console.log('1) Create a Linear workspace at https://linear.app');
console.log('');
console.log('2) API key → Settings → Security & access → Personal API keys');
console.log('   Add to root .env:');
console.log('');
console.log('   LINEAR_API_KEY=lin_api_…');
console.log('');
console.log('3) Team ID (for auto-created issues)');
console.log('   Run after step 2:  pnpm run linear:check');
console.log('   Copy a team id into .env:');
console.log('');
console.log('   LINEAR_TEAM_ID=<uuid from linear:check>');
console.log('');
console.log('4) GitHub integration (PR ↔ issue sync)');
console.log(`   Linear → Settings → Integrations → GitHub → connect ${REPO}`);
console.log('   Enable: branch naming, PR status, auto-close on merge');
console.log('');
console.log('5) Webhook (optional — issue updates → API)');
console.log('   Linear → Settings → API → Webhooks → New webhook');
console.log(`   URL: ${origin}/api/linear/webhook`);
console.log(`   or:  ${flyOrigin}/api/linear/webhook  (if API on Fly)`);
console.log('   Events: Issues, Comments');
console.log('   Copy signing secret to .env:');
console.log('');
console.log('   LINEAR_WEBHOOK_SECRET=…');
console.log('');
console.log('6) Sync env to Vercel + Fly');
console.log('   pnpm run linear:env-vercel');
console.log('   pnpm run fly:env-secrets');
console.log('');
console.log('7) Verify');
console.log('   pnpm run linear:check');
console.log(`   GET ${origin}/api/linear/health`);
console.log('');
console.log('Handoff integration:');
console.log('  Failed handoff tasks auto-create Linear issues (priority: High)');
console.log('  Trigger: pnpm run handoff:cycle  or QStash cron');
console.log('');
if (env.LINEAR_API_KEY) {
  console.log('✓ LINEAR_API_KEY present in .env');
} else {
  console.log('⚠ Add LINEAR_API_KEY to .env');
}
console.log('');

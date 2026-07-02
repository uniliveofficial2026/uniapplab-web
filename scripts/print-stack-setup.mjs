#!/usr/bin/env node
/**
 * Print InstaCollab production stack map.
 * Usage: pnpm run stack:setup
 */
const STACK = [
  ['Supabase', 'Auth, PostgreSQL, Realtime, Storage (users, profiles, posts, wallets, streams, notifications)'],
  ['Cloudflare', 'DNS, CDN, WAF, caching — passthrough /api/* to Vercel (no SPA rewrite on API)'],
  ['Vercel', 'Frontend hosting + Node API at /api/* (monorepo: instacollab + api-server)'],
  ['LiveKit', 'Audio/video — live screen (ic-stream-*) + party rooms (ic-party-*)'],
  ['Upstash Redis', 'Rate limits, feed cache, handoff queue, online presence, viewer counts, typing, session cache'],
];

const DATA = [
  ['PostgreSQL (Supabase)', 'Streams metadata, posts, profiles, wallets — durable source of truth'],
  ['Supabase Storage', 'Avatars, post media — not Postgres blobs'],
  ['Redis (Upstash)', 'Ephemeral only — presence TTL, viewer INCR, typing, cache'],
  ['LiveKit', 'Realtime A/V transport — not stored in Postgres'],
];

console.log('');
console.log('=== InstaCollab stack ===');
console.log('');
console.log('| Service | Purpose |');
console.log('| --- | --- |');
for (const [service, purpose] of STACK) {
  console.log(`| ${service} | ${purpose} |`);
}
console.log('');
console.log('Data placement:');
for (const [store, note] of DATA) {
  console.log(`  ${store.padEnd(22)} → ${note}`);
}
console.log('');
console.log('Deploy (API + SPA):');
console.log('  node scripts/sync-vercel-config.mjs   # writes repo-root vercel.json');
console.log('  pnpm run deploy:vercel:git            # recommended — git push → Vercel build');
console.log('  pnpm run deploy:vercel                # CLI staged upload (falls back to git on limits)');
console.log('');
console.log('Vercel dashboard: Root Directory must be "." (repo root), NOT artifacts/instacollab.');
console.log('');
console.log('Verify after deploy:');
console.log('  pnpm run verify:prod');
console.log('  pnpm run upstash:check -- --prod');
console.log('  pnpm run livekit:check -- --prod');
console.log('');
console.log('Env sync:');
console.log('  pnpm run upstash:env-vercel');
console.log('  pnpm run livekit:env-vercel');
console.log('');

#!/usr/bin/env node
/**
 * Print LiveKit setup steps for InstaCollab live streaming.
 * Usage: pnpm run livekit:setup
 */
import { readMergedEnv, findEnvFile } from './resolveProjectEnv.mjs';

const env = readMergedEnv(import.meta.dirname);
const envPath = findEnvFile(import.meta.dirname);
const origin = (env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');

console.log('');
console.log('=== LiveKit full setup (InstaCollab) ===');
console.log('');
console.log('1) Create a project at https://cloud.livekit.io');
console.log('   → Settings → Keys → create API key + secret');
console.log('   → Settings → Project → copy WebSocket URL (wss://…)');
console.log('');
console.log('2) Add to repo root .env:');
console.log('');
console.log('   LIVEKIT_API_KEY=API…');
console.log('   LIVEKIT_API_SECRET=…');
console.log('   LIVEKIT_URL=wss://your-project.livekit.cloud');
console.log('   VITE_LIVEKIT_URL=wss://your-project.livekit.cloud');
console.log('');
console.log('3) Configure LiveKit webhook (optional — auto-end streams when room closes):');
console.log(`   URL: ${origin}/api/livekit/webhook`);
console.log('   Events: room_finished');
console.log('');
console.log('4) Ensure streams tables exist in Supabase:');
console.log('   pnpm run auth:bootstrap-db   # or apply supabase/migrations/20260601210000_streams.sql');
console.log('');
console.log('5) Sync to Vercel + verify:');
console.log('   pnpm run livekit:env-vercel');
console.log('   pnpm run livekit:check');
console.log('   pnpm run deploy:vercel');
console.log('   pnpm run livekit:check -- --prod');
console.log('');
console.log('Endpoints after deploy:');
console.log(`  GET  ${origin}/api/livekit/health`);
console.log(`  POST ${origin}/api/livekit/token   (Bearer auth — host/viewer)`);
console.log('');
console.log('Go live: Live screen → streamer/admin role → picks LiveKit when VITE_LIVEKIT_URL is set.');
console.log('');
if (env.LIVEKIT_API_KEY && env.VITE_LIVEKIT_URL) {
  console.log(`✓ LiveKit keys present in ${envPath}`);
} else {
  console.log(`⚠ Add LIVEKIT_* and VITE_LIVEKIT_URL to ${envPath || 'repo root .env'}`);
}
console.log('');

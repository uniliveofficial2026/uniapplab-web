#!/usr/bin/env node
/**
 * Verify LiveKit credentials + optional production health endpoint.
 * Usage: pnpm run livekit:check [-- --prod]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function loadDotEnv() {
  for (const file of [
    path.join(ROOT, '.env'),
    path.join(ROOT, '.env.local'),
    path.join(ROOT, 'artifacts/instacollab/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadDotEnv();

const { probeProdApi } = await import('../../../scripts/probe-prod-api.mjs');
const { isLiveKitConfigured, pingLiveKit, getLiveKitUrl } = await import(
  '../../../lib/livekit/index.mjs'
);

let failed = 0;

if (!isLiveKitConfigured()) {
  console.error('[livekit] ✗ LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL not set');
  failed += 1;
} else {
  const ping = await pingLiveKit();
  if (ping.ok) {
    console.log(`[livekit] ✓ API reachable (${getLiveKitUrl()})`);
  } else {
    console.error(`[livekit] ✗ API check failed: ${ping.reason || 'unknown'}`);
    failed += 1;
  }
}

const clientUrl = (process.env.VITE_LIVEKIT_URL || process.env.LIVEKIT_URL || '').trim();
if (clientUrl && /^wss:\/\//i.test(clientUrl)) {
  console.log(`[livekit] ✓ Client URL ${clientUrl}`);
} else {
  console.error('[livekit] ✗ VITE_LIVEKIT_URL must be a wss:// URL for the browser');
  failed += 1;
}

const origin = (process.env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
if (process.argv.includes('--prod')) {
  try {
    const result = await probeProdApi(origin, '/api/livekit/health');
    if (result.ok && result.body?.ok) {
      console.log(`[livekit] ✓ Production health ${origin}`);
    } else if (result.body && result.body.configured === false) {
      console.error('[livekit] ✗ Production: LiveKit env not set on Vercel');
      failed += 1;
    } else if (result.reason) {
      console.error(`[livekit] ✗ Production health: ${result.reason}`);
      failed += 1;
    } else {
      console.error(`[livekit] ✗ Production health: ${result.reason || JSON.stringify(result.body)}`);
      failed += 1;
    }
  } catch (err) {
    console.error(`[livekit] ✗ Production health unreachable: ${err instanceof Error ? err.message : err}`);
    failed += 1;
  }
} else {
  console.log('[livekit] Tip: pnpm run livekit:check -- --prod after deploy');
}

process.exit(failed ? 1 : 0);

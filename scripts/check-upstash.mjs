#!/usr/bin/env node
/**
 * Verify local Upstash Redis + optional production health endpoint.
 * Usage: pnpm run upstash:check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const { isUpstashConfigured, pingRedis, getRedis, KEYS } = await import('@workspace/upstash');

let failed = 0;

if (!isUpstashConfigured()) {
  console.error('[upstash] ✗ UPSTASH_REDIS_REST_URL / TOKEN not set');
  failed += 1;
} else {
  const ping = await pingRedis();
  if (ping.ok) {
    console.log('[upstash] ✓ Redis PING');
    const redis = getRedis();
    await redis.set('ic:setup:probe', 'ok', { ex: 30 });
    const probe = await redis.get('ic:setup:probe');
    if (probe === 'ok') console.log('[upstash] ✓ Redis read/write');
    else {
      console.error('[upstash] ✗ Redis read/write failed');
      failed += 1;
    }
    console.log(`[upstash]   keys namespace: ${Object.values(KEYS).join(', ')}`);
  } else {
    console.error(`[upstash] ✗ Redis ping failed: ${ping.reason || 'unknown'}`);
    failed += 1;
  }
}

const origin = (process.env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
if (process.argv.includes('--prod')) {
  try {
    const res = await fetch(`${origin}/api/upstash/health`, { signal: AbortSignal.timeout(15000) });
    const body = await res.json();
    if (res.ok && body.ok) console.log(`[upstash] ✓ Production health ${origin}`);
    else {
      console.error(`[upstash] ✗ Production health: ${JSON.stringify(body)}`);
      failed += 1;
    }
  } catch (err) {
    console.error(`[upstash] ✗ Production health unreachable: ${err instanceof Error ? err.message : err}`);
    failed += 1;
  }
} else {
  console.log('[upstash] Tip: pnpm run upstash:check -- --prod after deploy');
}

if (!process.env.QSTASH_CURRENT_SIGNING_KEY) {
  console.warn('[upstash] ⚠ QSTASH_CURRENT_SIGNING_KEY missing — scheduled handoff webhook disabled');
}

process.exit(failed ? 1 : 0);

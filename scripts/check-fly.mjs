#!/usr/bin/env node
/**
 * Verify Fly.io API deployment health.
 * Usage: pnpm run fly:check [--prod]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv() {
  for (const file of [path.join(ROOT, '.env'), path.join(ROOT, 'artifacts/instacollab/.env')]) {
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

const flyApp = process.env.FLY_APP_NAME || 'uniapplab-api';
const flyOrigin = (process.env.FLY_API_ORIGIN || `https://${flyApp}.fly.dev`).replace(/\/$/, '');

const { probeProdApi } = await import('./probe-prod-api.mjs');

let failed = 0;

for (const apiPath of ['/api/healthz', '/api/upstash/health', '/api/linear/health']) {
  const result = await probeProdApi(flyOrigin, apiPath, { retries: 2 });
  if (result.ok) {
    console.log(`[fly] ✓ ${flyOrigin}${apiPath}`);
  } else {
    console.error(`[fly] ✗ ${flyOrigin}${apiPath} — ${result.reason || result.status}`);
    failed += 1;
  }
}

if (!fs.existsSync(path.join(ROOT, 'fly.toml'))) {
  console.error('[fly] ✗ fly.toml missing');
  failed += 1;
} else {
  console.log('[fly] ✓ fly.toml present');
}

if (failed) {
  console.error('');
  console.error('[fly] Not deployed yet? Run: pnpm run fly:setup && pnpm run fly:deploy');
}

process.exit(failed > 0 ? 1 : 0);

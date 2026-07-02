#!/usr/bin/env node
/**
 * Verify Fly.io API deployment health.
 * Usage: pnpm run fly:check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flyInstallHint, resolveFlyBin } from './lib/fly-cli.mjs';

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

let failed = 0;
let skipped = false;

if (!resolveFlyBin()) {
  console.warn('[fly] ⚠ flyctl not installed (optional until you deploy to Fly)');
  console.warn(flyInstallHint());
  skipped = true;
}

if (!fs.existsSync(path.join(ROOT, 'fly.toml'))) {
  console.error('[fly] ✗ fly.toml missing');
  failed += 1;
} else {
  console.log('[fly] ✓ fly.toml present');
}

if (!skipped) {
  const { probeProdApi } = await import('./probe-prod-api.mjs');

  for (const apiPath of ['/api/healthz', '/api/upstash/health', '/api/linear/health']) {
    try {
      const result = await probeProdApi(flyOrigin, apiPath, { retries: 1 });
      if (result.ok) {
        console.log(`[fly] ✓ ${flyOrigin}${apiPath}`);
      } else {
        const reason = result.reason || String(result.status);
        if (/ENOTFOUND|getaddrinfo|fetch failed/i.test(reason)) {
          console.warn(`[fly] ⚠ ${flyOrigin}${apiPath} — app not deployed yet`);
        } else {
          console.error(`[fly] ✗ ${flyOrigin}${apiPath} — ${reason}`);
          failed += 1;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/ENOTFOUND|getaddrinfo/i.test(msg)) {
        console.warn(`[fly] ⚠ ${flyOrigin} — app not deployed yet (${msg})`);
      } else {
        console.error(`[fly] ✗ ${flyOrigin}${apiPath} — ${msg}`);
        failed += 1;
      }
    }
  }
}

if (failed) {
  console.error('');
  console.error('[fly] Fix: pnpm run fly:setup && flyctl apps create', flyApp, '&& pnpm run fly:deploy');
}

process.exit(failed > 0 ? 1 : 0);

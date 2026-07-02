#!/usr/bin/env node
/**
 * Verify production URLs after deploy — triggers retry if broken.
 * Usage: pnpm run verify:prod
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = (process.env.PROD_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS ?? '15000');

const CHECKS = [
  { name: 'App shell', url: `${ORIGIN}/`, expect: (r, t) => r.ok && t.includes('InstaCollab') },
  { name: 'Live version', url: `${ORIGIN}/live-version.json`, expect: (r) => r.ok },
  { name: 'Supabase config', url: `${ORIGIN}/supabase-config.json`, expect: (r, t) => r.ok && /supabaseUrl/.test(t) },
  { name: 'DeepAR WASM', url: `${ORIGIN}/deepar-resources/wasm/deepar.wasm`, expect: (r, t, h) => r.ok && (h.get('content-type') || '').includes('wasm') },
  { name: 'DeepAR effect', url: `${ORIGIN}/effects/MakeupLook.deepar`, expect: (r) => r.ok },
  { name: 'API health', url: `${ORIGIN}/api/healthz`, expect: (r) => r.ok },
  { name: 'LiveKit health', url: `${ORIGIN}/api/livekit/health`, expect: (r, t) => r.ok || /not_configured/.test(t) },
  { name: 'Main JS bundle', url: `${ORIGIN}/index.html`, expect: (r, t) => r.ok && /\/assets\/index-[^"]+\.js/.test(t) },
];

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    const text = await res.text();
    return { res, text };
  } finally {
    clearTimeout(timer);
  }
}

const failures = [];
const passes = [];

for (const check of CHECKS) {
  try {
    const { res, text } = await fetchText(check.url);
    if (check.expect(res, text, res.headers)) {
      passes.push(check.name);
      console.log(`[verify] ✓ ${check.name}`);
    } else {
      failures.push(`${check.name} (${res.status})`);
      console.error(`[verify] ✗ ${check.name} — HTTP ${res.status}`);
    }
  } catch (err) {
    failures.push(`${check.name} (${err instanceof Error ? err.message : 'error'})`);
    console.error(`[verify] ✗ ${check.name} — ${err instanceof Error ? err.message : err}`);
  }
}

// Compare live-version to local build marker if present
const localVersionPath = path.join(ROOT, 'artifacts/instacollab/dist/public/live-version.json');
if (fs.existsSync(localVersionPath)) {
  try {
    const local = JSON.parse(fs.readFileSync(localVersionPath, 'utf8'));
    const { text } = await fetchText(`${ORIGIN}/live-version.json`);
    const remote = JSON.parse(text);
    if (local.id && remote.id && local.id !== remote.id) {
      console.warn(`[verify] ⚠ Production still on ${remote.id}, local build is ${local.id} — CDN may be propagating`);
    } else if (local.id === remote.id) {
      console.log('[verify] ✓ Production version matches latest build');
    }
  } catch {
    /* non-fatal */
  }
}

console.log('');
if (failures.length) {
  console.error(`[verify] FAILED (${failures.length}): ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`[verify] All ${passes.length} checks passed — ${ORIGIN}`);
process.exit(0);

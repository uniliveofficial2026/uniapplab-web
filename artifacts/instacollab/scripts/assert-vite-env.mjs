#!/usr/bin/env node
/**
 * Fail Vercel/production builds when Supabase env is missing or still placeholder.
 * Vite inlines VITE_* at build time — wrong/missing values break Google OAuth in prod.
 */
import fs from 'node:fs';
import path from 'node:path';
import { findEnvFile, getAppRoot, getWorkspaceRoot, readEnvFile } from './resolveProjectEnv.mjs';
import { readDeeparEnabled } from './read-deepar-enabled.mjs';
import {
  assignEnvUnlessStale,
  isStaleSupabaseUrl,
  supabaseProjectRef,
} from './stale-supabase-refs.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const repoRoot = getWorkspaceRoot(appRoot);
const domainsPath = path.join(repoRoot, 'config', 'uniapplab-domains.json');
const deeparEnabled = readDeeparEnabled(appRoot);
const publicConfigPath = path.join(appRoot, 'public', 'supabase-config.json');

function loadEnvForBuild() {
  const merged = {};
  for (const dir of [appRoot, repoRoot]) {
    for (const name of ['.env.production', '.env.production.local', '.env', '.env.local']) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) continue;
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m) continue;
        assignEnvUnlessStale(merged, m[1], m[2]);
      }
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VITE_') && value) assignEnvUnlessStale(merged, key, value);
  }
  // Prefer public/supabase-config.json written earlier in the build pipeline.
  if (fs.existsSync(publicConfigPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(publicConfigPath, 'utf8'));
      if (cfg.supabaseUrl && !isStaleSupabaseUrl(cfg.supabaseUrl)) {
        merged.VITE_SUPABASE_URL = String(cfg.supabaseUrl).replace(/\/$/, '');
        if (cfg.supabaseAnonKey) {
          merged.VITE_SUPABASE_ANON_KEY = String(cfg.supabaseAnonKey);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return merged;
}

const env = loadEnvForBuild();
const url = (env.VITE_SUPABASE_URL || '').trim();
const key = (env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
const deeparKey = (env.VITE_DEEPAR_LICENSE_KEY || '').trim();
const onVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const issues = [];
const deeparIssues = [];
if (!url || /your[_-]?project/i.test(url)) {
  issues.push('VITE_SUPABASE_URL is missing or still a placeholder');
}
if (!key || /your[_-]?(publishable|anon|supabase)/i.test(key)) {
  issues.push('VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) is missing or placeholder');
}
if (deeparEnabled && (!deeparKey || /your|xxxx|placeholder/i.test(deeparKey))) {
  deeparIssues.push('VITE_DEEPAR_LICENSE_KEY is missing — AR filters will be disabled in production');
}

let expectedRef = null;
if (fs.existsSync(domainsPath)) {
  try {
    const localEnv = readEnvFile(findEnvFile(import.meta.dirname));
    const localUrl = localEnv.VITE_SUPABASE_URL || '';
    if (localUrl && !isStaleSupabaseUrl(localUrl)) {
      expectedRef = supabaseProjectRef(localUrl);
    }
  } catch {
    /* ignore */
  }
}

let buildRef = null;
if (url) {
  buildRef = supabaseProjectRef(url);
  if (!buildRef) {
    issues.push('VITE_SUPABASE_URL is not a valid URL');
  } else if (isStaleSupabaseUrl(url)) {
    issues.push(`VITE_SUPABASE_URL points at retired project ${buildRef}`);
  }
}

if (onVercel && issues.length) {
  console.error('');
  console.error('[build] Supabase env required for Vercel (baked into the client at build time):');
  for (const line of issues) console.error(`  ✗ ${line}`);
  console.error('');
  console.error('  Set in Vercel → Settings → Environment Variables → Production → Redeploy.');
  console.error('  Local reference: artifacts/instacollab/.env');
  console.error('');
  process.exit(1);
}

if (onVercel && deeparIssues.length) {
  console.error('');
  console.error('[build] DeepAR license missing on Vercel — SDK/effects deploy but AR UI stays off:');
  for (const line of deeparIssues) console.error(`  ✗ ${line}`);
  console.error('');
  console.error('  Fix: pnpm --filter @workspace/instacollab run deepar:env-vercel');
  console.error('  Or: Vercel Dashboard → Environment Variables → VITE_DEEPAR_LICENSE_KEY → Redeploy');
  console.error('');
}

if (issues.length) {
  console.warn('[build] Supabase env not fully configured (OK for local demo builds):');
  for (const line of issues) console.warn(`  • ${line}`);
} else if (buildRef) {
  console.log(`[build] Supabase project for this build: ${buildRef}`);
  if (expectedRef && buildRef !== expectedRef) {
    console.warn(
      `[build] Warning: local .env uses ${expectedRef} but this build uses ${buildRef}. ` +
        'Google OAuth must be enabled on the project that ships to production.',
    );
  }
}

const appOrigin = (env.VITE_APP_ORIGIN || '').trim();
if (appOrigin && /localhost|127\.0\.0\.1|\[::1\]/i.test(appOrigin)) {
  if (onVercel || process.env.NODE_ENV === 'production') {
    console.error('');
    console.error(`[build] VITE_APP_ORIGIN must not be loopback in production (got ${appOrigin}).`);
    console.error('  Set VITE_APP_ORIGIN=https://app.uniapplab.com or Google OAuth will redirect to localhost.');
    console.error('');
    if (onVercel) process.exit(1);
  } else {
    console.warn(
      `[build] Warning: VITE_APP_ORIGIN is ${appOrigin} — production/native builds will force https://app.uniapplab.com.`,
    );
  }
} else if (appOrigin) {
  console.log(`[build] App origin for OAuth redirects: ${appOrigin}`);
}

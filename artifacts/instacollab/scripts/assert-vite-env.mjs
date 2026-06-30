#!/usr/bin/env node
/**
 * Fail Vercel/production builds when Supabase env is missing or still placeholder.
 * Vite inlines VITE_* at build time — wrong/missing values break Google OAuth in prod.
 */
import fs from 'node:fs';
import path from 'node:path';
import { findEnvFile, getAppRoot, getWorkspaceRoot, readEnvFile } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const repoRoot = getWorkspaceRoot(appRoot);
const domainsPath = path.join(repoRoot, 'config', 'uniapplab-domains.json');

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
        merged[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VITE_') && value) merged[key] = value;
  }
  return merged;
}

const env = loadEnvForBuild();
const url = (env.VITE_SUPABASE_URL || '').trim();
const key = (env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
const onVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const issues = [];
if (!url || /your[_-]?project/i.test(url)) {
  issues.push('VITE_SUPABASE_URL is missing or still a placeholder');
}
if (!key || /your[_-]?(publishable|anon|supabase)/i.test(key)) {
  issues.push('VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) is missing or placeholder');
}

let expectedRef = null;
if (fs.existsSync(domainsPath)) {
  try {
    const localEnv = readEnvFile(findEnvFile(import.meta.dirname));
    const localUrl = localEnv.VITE_SUPABASE_URL || '';
    if (localUrl) expectedRef = new URL(localUrl).hostname.split('.')[0];
  } catch {
    /* ignore */
  }
}

let buildRef = null;
if (url) {
  try {
    buildRef = new URL(url).hostname.split('.')[0];
  } catch {
    issues.push('VITE_SUPABASE_URL is not a valid URL');
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

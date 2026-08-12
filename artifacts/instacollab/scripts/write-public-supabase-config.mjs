#!/usr/bin/env node
/**
 * Write public/supabase-config.json before Vite build.
 * Runtime loader prefers this over stale VITE_* baked into JS (fixes wrong Vercel project ref).
 */
import fs from 'node:fs';
import path from 'node:path';
import { findEnvFile, getAppRoot, getWorkspaceRoot, readEnvFile } from './resolveProjectEnv.mjs';
import {
  STALE_PROJECT_REFS,
  assignEnvUnlessStale,
  isStaleSupabaseUrl,
  supabaseProjectRef,
} from './stale-supabase-refs.mjs';

function loadBuildEnv() {
  const appRoot = getAppRoot(import.meta.dirname);
  const repoRoot = getWorkspaceRoot(appRoot);
  const merged = {};
  for (const [key, value] of Object.entries(readEnvFile(findEnvFile(import.meta.dirname)))) {
    assignEnvUnlessStale(merged, key, value);
  }
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
    if ((key.startsWith('VITE_') || key.startsWith('SUPABASE_')) && value) {
      assignEnvUnlessStale(merged, key, value);
    }
  }
  return merged;
}

const appRoot = getAppRoot(import.meta.dirname);
const outPath = path.join(appRoot, 'public', 'supabase-config.json');
const existing =
  fs.existsSync(outPath) && isStaleSupabaseUrl(JSON.parse(fs.readFileSync(outPath, 'utf8')).supabaseUrl || '')
    ? null
    : fs.existsSync(outPath)
      ? JSON.parse(fs.readFileSync(outPath, 'utf8'))
      : null;

const env = loadBuildEnv();
let url = (
  env.SUPABASE_URL ||
  env.VITE_SUPABASE_URL ||
  existing?.supabaseUrl ||
  ''
).trim().replace(/\/$/, '');
let anonKey =
  env.SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  existing?.supabaseAnonKey ||
  '';

const ref = supabaseProjectRef(url);
if (ref && STALE_PROJECT_REFS.has(ref)) {
  if (existing?.supabaseUrl && !isStaleSupabaseUrl(existing.supabaseUrl)) {
    url = existing.supabaseUrl;
    anonKey = existing.supabaseAnonKey || anonKey;
    console.warn(
      `[supabase-config] Ignoring stale Vercel project ${ref}; keeping ${supabaseProjectRef(url)} from public/supabase-config.json`,
    );
  } else {
    console.error(`[supabase-config] Refusing to write stale Supabase project ${ref}.`);
    console.error('  Update Vercel Production env to the active Supabase project, or commit public/supabase-config.json.');
    process.exit(1);
  }
}

if (!url || !anonKey || /your[_-]?(project|anon|publishable)/i.test(url + anonKey)) {
  if (existing?.supabaseUrl && existing?.supabaseAnonKey) {
    fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
    console.log(`[supabase-config] Kept existing ${outPath} (${supabaseProjectRef(existing.supabaseUrl)})`);
    process.exit(0);
  }
  console.warn('[supabase-config] Supabase env missing — skipping write (demo build OK)');
  process.exit(0);
}

const payload = { supabaseUrl: url, supabaseAnonKey: anonKey };
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[supabase-config] Wrote ${outPath} (${supabaseProjectRef(url)})`);

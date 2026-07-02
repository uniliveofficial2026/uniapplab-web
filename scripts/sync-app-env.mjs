#!/usr/bin/env node
/**
 * Sync VITE_* / SUPABASE_* keys from workspace .env → artifacts/instacollab/.env
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_ENV = path.join(ROOT, 'artifacts/instacollab/.env');
const SOURCES = [path.join(ROOT, '.env'), path.join(ROOT, '.env.local')];

const SYNC_PREFIXES = ['VITE_', 'SUPABASE_', 'RESEND_', 'DEEPAR_', 'UPSTASH_', 'QSTASH_', 'PUBLIC_APP_'];

function parseEnvFile(file) {
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out.set(m[1], m[2]);
  }
  return out;
}

function shouldSync(key) {
  return SYNC_PREFIXES.some((p) => key.startsWith(p));
}

const merged = new Map();
for (const src of SOURCES) {
  for (const [k, v] of parseEnvFile(src)) {
    if (shouldSync(k)) merged.set(k, v);
  }
}

if (merged.size === 0) {
  console.log('[sync-env] No keys to sync');
  process.exit(0);
}

const existing = parseEnvFile(APP_ENV);
let changed = 0;
for (const [k, v] of merged) {
  if (existing.get(k) !== v) changed += 1;
  existing.set(k, v);
}

const lines = [...existing.entries()].map(([k, v]) => `${k}=${v}`);
fs.mkdirSync(path.dirname(APP_ENV), { recursive: true });
fs.writeFileSync(APP_ENV, `${lines.join('\n')}\n`);

console.log(`[sync-env] ${changed ? `Updated ${changed} key(s)` : 'Already in sync'} → artifacts/instacollab/.env`);

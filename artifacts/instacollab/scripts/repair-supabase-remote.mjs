#!/usr/bin/env node
/**
 * Force-apply critical Supabase repairs with retries (one statement at a time).
 * Usage: node scripts/repair-supabase-remote.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findEnvFile,
  getAppRoot,
  readMergedEnv,
  supabaseProjectRefFromEnv,
} from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(path.dirname(fileURLToPath(import.meta.url)));
const env = { ...readMergedEnv(path.dirname(fileURLToPath(import.meta.url))), ...process.env };
const accessToken = (env.SUPABASE_ACCESS_TOKEN || '').trim();
const ref = supabaseProjectRefFromEnv(findEnvFile(path.dirname(fileURLToPath(import.meta.url))));

if (!accessToken || !ref) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or VITE_SUPABASE_URL in .env');
  process.exit(1);
}

const STATEMENTS = [
  `alter table public.profiles add column if not exists live_status text check (live_status is null or live_status in ('live', 'ended'));`,
  `alter table public.profiles add column if not exists live_kind text;`,
  `alter table public.profiles add column if not exists live_started_at timestamptz;`,
  `create index if not exists profiles_live_idx on public.profiles (live_status, live_started_at desc) where live_status = 'live';`,
];

async function runQuery(query, attempt) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function runWithRetries(query, label) {
  const max = 5;
  for (let i = 1; i <= max; i++) {
    try {
      console.log(`[repair] ${label} (attempt ${i}/${max})…`);
      const result = await runQuery(query, i);
      console.log(`[repair] ✓ ${label}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[repair] ✗ ${label}: ${msg}`);
      if (i === max) throw err;
      const waitMs = Math.min(30_000, 3000 * i);
      console.log(`[repair] waiting ${waitMs}ms…`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

console.log(`[repair] Supabase project ${ref} — applying ${STATEMENTS.length} statements…`);

for (let i = 0; i < STATEMENTS.length; i++) {
  await runWithRetries(STATEMENTS[i], `statement ${i + 1}/${STATEMENTS.length}`);
}

console.log('[repair] All statements applied successfully.');

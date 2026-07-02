#!/usr/bin/env node
/**
 * Apply posts + post-media migration to Supabase.
 * Usage: pnpm --filter @workspace/instacollab run posts:bootstrap-db
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = path.join(ROOT, 'supabase/migrations/20260701120000_posts.sql');

function readEnv() {
  for (const file of [path.join(ROOT, '.env'), path.join(ROOT, '../../.env')]) {
    if (!fs.existsSync(file)) continue;
    const env = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return env;
  }
  return {};
}

const env = { ...readEnv(), ...process.env };
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.log(`
[posts:bootstrap] Apply migration manually in Supabase SQL Editor:
  ${MIGRATION}

Or set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env and re-run.
`);
  process.exit(0);
}

const sql = fs.readFileSync(MIGRATION, 'utf8');
const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
}).catch(() => null);

if (!res?.ok) {
  console.log('[posts:bootstrap] Could not run via API — paste SQL in Supabase dashboard:');
  console.log(sql.slice(0, 500) + '...');
  process.exit(0);
}

console.log('[posts:bootstrap] Migration applied.');

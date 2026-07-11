#!/usr/bin/env node
/**
 * Apply every supabase/migrations/*.sql to the linked project (fresh DB bootstrap).
 * Uses SUPABASE_ACCESS_TOKEN + VITE_SUPABASE_URL from .env
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findEnvFile,
  getAppRoot,
  getWorkspaceRoot,
  readEnvFile,
  supabaseProjectRefFromEnv,
} from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(path.dirname(fileURLToPath(import.meta.url)));
const migrationsDir = path.join(appRoot, 'supabase', 'migrations');
const workspaceEnv = readEnvFile(path.join(getWorkspaceRoot(appRoot), '.env'));
const appEnv = readEnvFile(findEnvFile(path.dirname(fileURLToPath(import.meta.url))));
const env = { ...workspaceEnv, ...appEnv, ...process.env };
const accessToken = (env.SUPABASE_ACCESS_TOKEN || '').trim();
const ref = supabaseProjectRefFromEnv(findEnvFile(path.dirname(fileURLToPath(import.meta.url))));

if (!accessToken || !ref) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or VITE_SUPABASE_URL');
  process.exit(1);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

async function runQuery(query, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    throw new Error(`${label} → HTTP ${res.status}: ${detail}`);
  }
  return body;
}

console.log(`[migrate] project ${ref} — ${files.length} migrations`);

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const label = `${i + 1}/${files.length} ${file}`;
  const max = 4;
  let lastErr;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      process.stdout.write(`[migrate] ${label} (attempt ${attempt})… `);
      await runQuery(sql, file);
      console.log('ok');
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.log('fail');
      console.warn(msg.slice(0, 500));
      // Idempotent re-runs: ignore already-exists style errors on retry of whole file
      if (/already exists|duplicate_object|42710/i.test(msg) && attempt === max) {
        console.warn(`[migrate] treating as ok (already applied): ${file}`);
        lastErr = null;
        break;
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  if (lastErr) {
    console.error(`[migrate] STOPPED on ${file}`);
    process.exit(1);
  }
}

await runQuery(`notify pgrst, 'reload schema';`, 'reload');
console.log('[migrate] Done — schema reloaded.');

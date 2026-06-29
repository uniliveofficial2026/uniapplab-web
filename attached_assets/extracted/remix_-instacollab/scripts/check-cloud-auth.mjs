#!/usr/bin/env node
/**
 * Validate cloud auth env and list required Supabase migrations.
 * Usage: npm run auth:check
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const envPath = path.join(root, '.env');
const migrationsDir = path.join(root, 'supabase', 'migrations');

async function main() {
let exitCode = 0;
const issues = [];
const ok = [];

function readEnv() {
  if (!fs.existsSync(envPath)) {
    issues.push('Missing .env — copy .env.example and set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY');
    return {};
  }
  const text = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = readEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey =
  env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const firebaseProject = env.VITE_FIREBASE_PROJECT_ID || '';

if (!supabaseUrl || supabaseUrl.includes('your-project')) {
  issues.push('VITE_SUPABASE_URL is missing or placeholder');
} else {
  ok.push(`Supabase URL: ${supabaseUrl}`);
}

if (!supabaseKey || supabaseKey.includes('your_publishable')) {
  issues.push('VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) is missing or placeholder');
} else {
  ok.push('Supabase anon key: set');
}

if (firebaseProject) {
  ok.push(`Firebase project (legacy/optional): ${firebaseProject}`);
}

const bootstrapPath = path.join(root, 'supabase', 'bootstrap.sql');
const migrationFiles = fs.existsSync(migrationsDir)
  ? fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
  : [];

async function probeTable(url, key, table, selectColumn = 'id') {
  const base = url.replace(/\/$/, '');
  const res = await fetch(`${base}/rest/v1/${table}?select=${selectColumn}&limit=0`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const body = await res.text();
  if (res.ok) return { ok: true };
  if (/schema cache|could not find|pgrst205/i.test(body)) {
    return { ok: false, missingTable: true, body };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: true, note: `${table} reachable (auth required for rows)` };
  }
  return { ok: false, body };
}

console.log('');
console.log('Cloud auth check');
console.log('────────────────');

if (supabaseUrl && supabaseKey) {
  try {
    const profilesProbe = await probeTable(supabaseUrl, supabaseKey, 'profiles');
    if (profilesProbe.ok) {
      ok.push('public.profiles table: exists');
    } else if (profilesProbe.missingTable) {
      exitCode = 1;
      issues.push(
        'public.profiles table is MISSING on Supabase — run: npm run auth:bootstrap-db'
      );
    } else {
      issues.push(
        `Could not verify profiles table (${profilesProbe.body?.slice(0, 120) ?? 'unknown'})`
      );
    }

    const appStateProbe = await probeTable(
      supabaseUrl,
      supabaseKey,
      'user_app_state',
      'user_id'
    );
    if (appStateProbe.ok) {
      ok.push('public.user_app_state table: exists (realtime app data sync)');
    } else if (appStateProbe.missingTable) {
      exitCode = 1;
      issues.push(
        'public.user_app_state table is MISSING — likes/posts/messages will NOT sync across tabs/devices. Run full supabase/bootstrap.sql (npm run auth:bootstrap-db) or migration 20260601160000_user_app_state.sql'
      );
    } else {
      issues.push(
        `Could not verify user_app_state table (${appStateProbe.body?.slice(0, 120) ?? 'unknown'})`
      );
    }
  } catch (err) {
    issues.push(`Could not reach Supabase: ${err instanceof Error ? err.message : err}`);
  }
}

if (ok.length) {
  for (const line of ok) console.log(`  ✓ ${line}`);
}

if (migrationFiles.length) {
  console.log('');
  console.log('  Or apply migrations one-by-one:');
  for (const f of migrationFiles) console.log(`    • supabase/migrations/${f}`);
  console.log('');
  console.log('  Faster: one file → supabase/bootstrap.sql (npm run auth:bootstrap-db)');
} else {
  issues.push('No migration files found under supabase/migrations/');
}

console.log('');
if (issues.length) {
  console.log('  Issues:');
  for (const line of issues) console.log(`    ✗ ${line}`);
} else if (supabaseUrl && supabaseKey && exitCode === 0) {
  console.log('  Cloud DB + env look ready. Dashboard:');
  console.log('    • Enable Email + Google providers');
  console.log('    • URL Configuration: Site URL + Redirect URLs');
  console.log('    • For Google: npm run dev:public && npm run oauth:setup');
}

console.log('');
console.log('  Docs: docs/CLOUD_AUTH.md');
console.log('');

process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

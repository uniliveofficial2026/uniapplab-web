#!/usr/bin/env node
/**
 * Validate cloud auth env and probe Supabase tables.
 * Usage: pnpm run auth:check  (repo root or artifacts/instacollab)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  findEnvFile,
  getAppRoot,
  readEnvFile,
} from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const envPath = findEnvFile(import.meta.dirname);
const migrationsDir = path.join(appRoot, 'supabase', 'migrations');

async function main() {
  let exitCode = 0;
  const issues = [];
  const ok = [];

  const env = readEnvFile(envPath);
  if (!fs.existsSync(envPath)) {
    issues.push(
      'Missing .env — set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in artifacts/instacollab/.env or repo root',
    );
  } else {
    ok.push(`.env: ${envPath}`);
  }

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
    issues.push(
      'VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) is missing or placeholder',
    );
  } else {
    ok.push('Supabase anon key: set');
  }

  if (firebaseProject) {
    ok.push(`Firebase backup OAuth: ${firebaseProject}`);
  } else if (supabaseUrl && !supabaseUrl.includes('your-project')) {
    issues.push(
      'VITE_FIREBASE_PROJECT_ID missing — Google/Apple backup sign-in will not work when Supabase OAuth is down',
    );
  }

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
  console.log('  (SQL like select to_regclass(...) runs in Supabase SQL Editor — not Terminal.)');
  console.log('');

  if (supabaseUrl && supabaseKey) {
    try {
      const base = supabaseUrl.replace(/\/$/, '');
      const settingsRes = await fetch(`${base}/auth/v1/settings`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        const googleOn = Boolean(settings?.external?.google);
        const emailOn = Boolean(settings?.external?.email);
        if (googleOn) {
          ok.push('Supabase Google provider: enabled');
        } else {
          exitCode = 1;
          issues.push(
            'Supabase Google provider is OFF — enable at Dashboard → Authentication → Providers → Google',
          );
        }
        if (emailOn) {
          ok.push('Supabase email provider: enabled');
        } else {
          issues.push('Supabase email provider is OFF — enable under Authentication → Providers → Email');
        }
      } else {
        issues.push(`Could not read Supabase auth settings (HTTP ${settingsRes.status})`);
      }

      const profilesProbe = await probeTable(supabaseUrl, supabaseKey, 'profiles');
      if (profilesProbe.ok) {
        ok.push('public.profiles table: exists');
        const noteProbe = await probeTable(supabaseUrl, supabaseKey, 'profiles', 'note');
        if (noteProbe.ok) {
          ok.push('profiles.note column: exists (thought bubble cloud sync)');
        } else if (noteProbe.missingTable) {
          exitCode = 1;
          issues.push(
            'profiles.note column is MISSING — re-run pnpm run auth:bootstrap-db (bootstrap.sql includes thought sync)',
          );
        }
      } else if (profilesProbe.missingTable) {
        exitCode = 1;
        issues.push(
          'public.profiles table is MISSING on Supabase — run: pnpm run auth:bootstrap-db',
        );
      } else {
        issues.push(
          `Could not verify profiles table (${profilesProbe.body?.slice(0, 120) ?? 'unknown'})`,
        );
      }

      const appStateProbe = await probeTable(
        supabaseUrl,
        supabaseKey,
        'user_app_state',
        'user_id',
      );
      if (appStateProbe.ok) {
        ok.push('public.user_app_state table: exists (realtime app data sync)');
      } else if (appStateProbe.missingTable) {
        exitCode = 1;
        issues.push(
          'public.user_app_state table is MISSING — run pnpm run auth:bootstrap-db (bootstrap-full.sql)',
        );
      } else {
        issues.push(
          `Could not verify user_app_state table (${appStateProbe.body?.slice(0, 120) ?? 'unknown'})`,
        );
      }

      for (const [table, col, label] of [
        ['follows', 'follower_id', 'public.follows (global social graph)'],
        ['party_rooms', 'owner_id', 'public.party_rooms (K-Star room discovery)'],
        ['party_room_messages', 'room_id', 'public.party_room_messages (live room chat)'],
        ['streams', 'user_id', 'public.streams (live discovery)'],
        ['posts', 'author_id', 'public.posts (shared feed)'],
      ]) {
        const probe = await probeTable(supabaseUrl, supabaseKey, table, col);
        if (probe.ok) {
          ok.push(`${label}: exists`);
        } else if (probe.missingTable) {
          exitCode = 1;
          if (table === 'follows') {
            issues.push(`${label} is MISSING — run: pnpm run auth:repair-follows`);
          } else if (table === 'party_room_messages') {
            issues.push(
              `${label} is MISSING — paste supabase/migrations/20260703140000_party_room_chat.sql in SQL Editor`,
            );
          } else {
            issues.push(`${label} is MISSING — run pnpm run auth:bootstrap-db`);
          }
        }
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
    console.log('  Faster: one file → supabase/bootstrap-full.sql (pnpm run auth:bootstrap-db)');
  } else if (!fs.existsSync(path.join(appRoot, 'supabase', 'bootstrap.sql'))) {
    issues.push('Missing supabase/bootstrap.sql under artifacts/instacollab/');
  }

  console.log('');
  if (issues.length) {
    console.log('  Issues:');
    for (const line of issues) console.log(`    ✗ ${line}`);
  } else if (supabaseUrl && supabaseKey && exitCode === 0) {
    const ref = (() => {
      try {
        return new URL(supabaseUrl).hostname.split('.')[0];
      } catch {
        return null;
      }
    })();
    console.log('  Cloud DB + env look ready.');
    if (ref) {
      console.log(`    • Google OAuth uses signInWithOAuth({ provider: "google" }) → project ${ref}`);
    }
    console.log('    • Vercel: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (same project) and redeploy');
    console.log('    • Supabase URL Configuration: Site URL + Redirect URLs (pnpm run oauth:setup)');
  }

  console.log('');
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

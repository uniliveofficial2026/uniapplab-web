#!/usr/bin/env node
/**
 * Copy supabase/bootstrap.sql and open Supabase SQL Editor.
 * Usage: npm run auth:bootstrap-db   ← run in Terminal, NOT in SQL Editor
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const bootstrapPath = path.join(root, 'supabase', 'bootstrap.sql');
const profilesOnlyPath = path.join(root, 'supabase', 'bootstrap-profiles-only.sql');
const envPath = path.join(root, '.env');

function projectRefFromEnv() {
  if (!fs.existsSync(envPath)) return 'kgiaflmukkguzjtmcuqd';
  const m = fs.readFileSync(envPath, 'utf8').match(/^VITE_SUPABASE_URL=(.+)$/m);
  if (!m) return 'kgiaflmukkguzjtmcuqd';
  try {
    const host = new URL(m[1].trim()).hostname;
    return host.split('.')[0] || 'kgiaflmukkguzjtmcuqd';
  } catch {
    return 'kgiaflmukkguzjtmcuqd';
  }
}

const ref = projectRefFromEnv();
const sqlUrl = `https://supabase.com/dashboard/project/${ref}/sql/new`;
const bootstrapSql = fs.readFileSync(bootstrapPath, 'utf8');

console.log('');
console.log('InstaCollab — cloud database bootstrap');
console.log('──────────────────────────────────────');
console.log('');
console.log('  ⚠  Do NOT paste "npm run auth:bootstrap-db" into Supabase SQL Editor.');
console.log('     That command runs here in your Mac Terminal. The SQL Editor only accepts SQL.');
console.log('');
console.log('  Step A — you are here (Terminal):');
console.log('     npm run auth:bootstrap-db');
console.log('');
console.log('  Step B — Supabase website (SQL Editor):');
console.log(`     ${sqlUrl}`);
console.log('     • New query → paste from clipboard (starts with "-- InstaCollab")');
console.log('     • Click RUN → expect "Success. No rows returned"');
console.log('');
console.log('  Step C — app: hard refresh (Cmd+Shift+R), sign in again');
console.log('');
console.log('  Step D — verify (Terminal again):');
console.log('     npm run auth:check');
console.log('     Should show profiles + user_app_state tables exist.');
console.log('');
console.log(`  SQL file on disk: ${bootstrapPath}`);
if (fs.existsSync(profilesOnlyPath)) {
  console.log(`  Profiles-only (skip sync): ${profilesOnlyPath}`);
}
console.log('');

if (process.platform === 'darwin') {
  try {
    execSync('pbcopy', { input: bootstrapSql });
    console.log('  ✓ Full bootstrap.sql copied to clipboard — paste in SQL Editor now.');
    console.log('');
  } catch {
    console.log('  Could not copy to clipboard — open bootstrap.sql and copy manually.');
    console.log('');
  }
} else {
  console.log('  Copy the contents of supabase/bootstrap.sql into the SQL Editor.');
  console.log('');
}

try {
  execSync(`open "${sqlUrl}"`, { stdio: 'ignore' });
  console.log('  ✓ Opened Supabase SQL Editor in your browser.');
  console.log('');
} catch {
  /* ignore */
}

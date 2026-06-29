#!/usr/bin/env node
/**
 * Copy supabase/bootstrap.sql and open Supabase SQL Editor.
 * Run from repo root OR artifacts/instacollab:
 *   pnpm run auth:bootstrap-db
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  findEnvFile,
  getAppRoot,
  supabaseProjectRefFromEnv,
} from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const bootstrapPath = path.join(appRoot, 'supabase', 'bootstrap.sql');
const repairPoliciesPath = path.join(appRoot, 'supabase', 'repair-policies.sql');
const profilesOnlyPath = path.join(appRoot, 'supabase', 'bootstrap-profiles-only.sql');
const envPath = findEnvFile(import.meta.dirname);

if (!fs.existsSync(bootstrapPath)) {
  console.error('');
  console.error('Missing supabase/bootstrap.sql at:', bootstrapPath);
  console.error('Expected under artifacts/instacollab/supabase/');
  console.error('');
  process.exit(1);
}

const ref = supabaseProjectRefFromEnv(envPath) || 'YOUR_PROJECT_REF';
const sqlUrl = `https://supabase.com/dashboard/project/${ref}/sql/new`;
const bootstrapSql = fs.readFileSync(bootstrapPath, 'utf8');

console.log('');
console.log('InstaCollab — cloud database bootstrap');
console.log('──────────────────────────────────────');
console.log('');
console.log('  ⚠  Do NOT paste "pnpm run auth:bootstrap-db" into Supabase SQL Editor.');
console.log('     That command runs in Terminal. The SQL Editor only accepts SQL.');
console.log('');
console.log('  Step A — you are here (Terminal):');
console.log('     pnpm run auth:bootstrap-db');
console.log('');
console.log('  Step B — Supabase SQL Editor:');
console.log(`     ${sqlUrl}`);
console.log('     • New query → paste from clipboard (starts with "-- InstaCollab")');
console.log('     • Click RUN → expect "Success. No rows returned"');
console.log('');
console.log('  Step C — app: hard refresh (Cmd+Shift+R), sign in again');
console.log('');
console.log('  Step D — verify (Terminal):');
console.log('     pnpm run auth:check');
console.log('');
console.log(`  .env used: ${fs.existsSync(envPath) ? envPath : '(not found — set VITE_SUPABASE_URL in .env)'}`);
console.log(`  SQL file:  ${bootstrapPath}`);
if (fs.existsSync(repairPoliciesPath)) {
  console.log(`  Policy repair (if 42710 already exists): ${repairPoliciesPath}`);
}
if (fs.existsSync(profilesOnlyPath)) {
  console.log(`  Profiles-only: ${profilesOnlyPath}`);
}
console.log('');

if (process.platform === 'darwin') {
  try {
    execSync('pbcopy', { input: bootstrapSql });
    console.log('  ✓ bootstrap.sql copied to clipboard — paste in SQL Editor now.');
    console.log('');
  } catch {
    console.log('  Could not copy to clipboard — open bootstrap.sql and copy manually.');
    console.log('');
  }
} else {
  console.log('  Copy supabase/bootstrap.sql into the SQL Editor.');
  console.log('');
}

try {
  execSync(`open "${sqlUrl}"`, { stdio: 'ignore' });
  console.log('  ✓ Opened Supabase SQL Editor in your browser.');
  console.log('');
} catch {
  /* ignore */
}

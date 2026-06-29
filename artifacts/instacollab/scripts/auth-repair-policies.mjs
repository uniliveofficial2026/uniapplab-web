#!/usr/bin/env node
/**
 * Copy supabase/repair-policies.sql and open Supabase SQL Editor.
 * Use when bootstrap fails with ERROR 42710 (policy already exists).
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
const repairPath = path.join(appRoot, 'supabase', 'repair-policies.sql');
const envPath = findEnvFile(import.meta.dirname);

if (!fs.existsSync(repairPath)) {
  console.error('Missing:', repairPath);
  process.exit(1);
}

const ref = supabaseProjectRefFromEnv(envPath) || 'YOUR_PROJECT_REF';
const sqlUrl = `https://supabase.com/dashboard/project/${ref}/sql/new`;
const repairSql = fs.readFileSync(repairPath, 'utf8');

console.log('');
console.log('InstaCollab — repair RLS policies (42710 already exists)');
console.log('──────────────────────────────────────────────────────────');
console.log('');
console.log(`  SQL Editor: ${sqlUrl}`);
console.log('  Paste repair-policies.sql → Run → expect Success');
console.log('  Then: pnpm run auth:check');
console.log('');

if (process.platform === 'darwin') {
  try {
    execSync('pbcopy', { input: repairSql });
    console.log('  ✓ repair-policies.sql copied to clipboard.');
  } catch {
    console.log('  Copy supabase/repair-policies.sql manually.');
  }
}

try {
  execSync(`open "${sqlUrl}"`, { stdio: 'ignore' });
} catch {
  /* ignore */
}

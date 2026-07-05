#!/usr/bin/env node
/**
 * Apply follows table to Supabase (no manual SQL Editor paste).
 * Usage: pnpm run auth:repair-follows
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { getAppRoot } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const applyScript = path.join(appRoot, 'scripts', 'apply-supabase-sql.mjs');
const repairSql = path.join(appRoot, 'supabase', 'repair-follows.sql');

console.log('');
console.log('InstaCollab — apply follows table');
console.log('─────────────────────────────────');
console.log('');

const result = spawnSync(process.execPath, [applyScript, repairSql], {
  cwd: appRoot,
  stdio: 'inherit',
});

if (result.status === 0) {
  console.log('');
  console.log('  Next: pnpm run auth:check');
  console.log('');
  process.exit(0);
}

console.error('');
console.error('  Automatic apply failed. Fallback: paste supabase/repair-follows.sql in SQL Editor.');
process.exit(result.status ?? 1);

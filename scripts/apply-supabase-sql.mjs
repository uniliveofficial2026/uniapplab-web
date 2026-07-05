#!/usr/bin/env node
/**
 * Repo-root entry for Supabase SQL apply (delegates to instacollab).
 * Usage: node scripts/apply-supabase-sql.mjs supabase/repair-follows.sql
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const instacollabRoot = path.join(ROOT, 'artifacts/instacollab');
const applyScript = path.join(instacollabRoot, 'scripts/apply-supabase-sql.mjs');

const sqlArgs = process.argv.slice(2).filter((arg) => arg !== '--').map((arg) =>
  arg.replace(/^artifacts\/instacollab\//, ''),
);

const result = spawnSync(process.execPath, [applyScript, ...sqlArgs], {
  cwd: instacollabRoot,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);

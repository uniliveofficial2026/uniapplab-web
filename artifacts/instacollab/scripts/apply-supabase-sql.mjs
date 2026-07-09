#!/usr/bin/env node
/**
 * Apply a .sql file to the linked Supabase project via Management API.
 * Usage: node scripts/apply-supabase-sql.mjs supabase/repair-follows.sql
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  findEnvFile,
  getAppRoot,
  readMergedEnv,
  supabaseProjectRefFromEnv,
} from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const sqlPath = process.argv[2];

if (!sqlPath) {
  console.error('Usage: node scripts/apply-supabase-sql.mjs <path-to.sql>');
  process.exit(1);
}

const resolvedSqlPath = path.isAbsolute(sqlPath) ? sqlPath : path.join(appRoot, sqlPath);
if (!fs.existsSync(resolvedSqlPath)) {
  console.error('SQL file not found:', resolvedSqlPath);
  process.exit(1);
}

const env = { ...readMergedEnv(import.meta.dirname), ...process.env };
const accessToken = (env.SUPABASE_ACCESS_TOKEN || '').trim();
const ref = supabaseProjectRefFromEnv(findEnvFile(import.meta.dirname));

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env');
  console.error('Create one at https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

if (!ref) {
  console.error('Missing VITE_SUPABASE_URL in .env');
  process.exit(1);
}

const sql = fs.readFileSync(resolvedSqlPath, 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const bodyText = await res.text();
let body;
try {
  body = JSON.parse(bodyText);
} catch {
  body = bodyText;
}

if (!res.ok) {
  console.error('Supabase query failed:', res.status, typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(`✓ Applied ${path.basename(resolvedSqlPath)} to project ${ref}`);

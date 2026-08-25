#!/usr/bin/env node
/**
 * Static gate: auth boot uses a single Supabase session restore path when
 * Supabase is primary; demo/local bypass is not production auth authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(ok ? `PASS ${name}` : `FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

const authProvider = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/auth/AuthProvider.tsx'),
  'utf8',
);
const config = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/auth/config.ts'),
  'utf8',
);
const devLocal = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/auth/devLocalAuth.ts'),
  'utf8',
);
const localDemo = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/auth/localDemoAuth.ts'),
  'utf8',
);

check(
  'primary_cloud_is_supabase_when_configured',
  /export function isPrimarySupabaseCloud\(\): boolean/.test(config) &&
    /return isSupabaseConfigured\(\)/.test(config),
  'isPrimarySupabaseCloud must prefer Supabase when configured',
);

check(
  'authprovider_restores_via_getSession',
  /supabase\.auth\.getSession\(/.test(authProvider) &&
    /onAuthStateChange/.test(authProvider) &&
    /isPrimarySupabaseCloud\(/.test(authProvider),
  'AuthProvider must restore via Supabase getSession + onAuthStateChange when primary',
);

check(
  'dev_local_bypass_is_dev_only',
  /Dev-only|dev-only|local demo/i.test(devLocal) &&
    !/production auth authority/i.test(devLocal),
  'devLocalAuth must remain documented as non-production',
);

check(
  'local_demo_not_production_authority',
  /IndexedDB|local demo|demo login/i.test(localDemo) || /enableDevLocalAuthBypass/.test(localDemo),
  'localDemoAuth must be local/demo scoped',
);

// Ensure production primary path does not treat demo user id as authority without cloud session.
check(
  'authprovider_supabase_primary_skips_firebase_lane_restore',
  /if \(isPrimarySupabaseCloud\(\)\)/.test(authProvider),
  'when Supabase is primary, AuthProvider must branch away from Firebase-only restore',
);

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} auth-boot gate(s) failed`);
  process.exit(1);
}
console.log('\nauth-boot gates PASS');

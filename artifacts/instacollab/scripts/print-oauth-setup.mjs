#!/usr/bin/env node
/**
 * Print exact Google + Supabase OAuth URLs for UniAppLab domains.
 * Usage: pnpm run oauth:setup
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  findEnvFile,
  getAppRoot,
  getWorkspaceRoot,
  readEnvFile,
  supabaseProjectRefFromEnv,
} from './resolveProjectEnv.mjs';

const repoRoot = getWorkspaceRoot(getAppRoot(import.meta.dirname));
const domainsPath = path.join(repoRoot, 'config', 'uniapplab-domains.json');
const domains = JSON.parse(fs.readFileSync(domainsPath, 'utf8'));

const envPath = findEnvFile(import.meta.dirname);
const env = readEnvFile(envPath);

const supabaseUrl = (env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseCallback = supabaseUrl
  ? `${supabaseUrl}/auth/v1/callback`
  : 'https://YOUR-PROJECT.supabase.co/auth/v1/callback';

const appOrigin = (env.VITE_APP_ORIGIN || domains.supabase.siteUrl).trim().replace(/\/$/, '');
const ref = supabaseProjectRefFromEnv(envPath) || 'YOUR_PROJECT_REF';
const supabaseAuthUrl = `https://supabase.com/dashboard/project/${ref}/auth/url-configuration`;
const supabaseProvidersUrl = `https://supabase.com/dashboard/project/${ref}/auth/providers?provider=Google`;

const redirectUrls = [...new Set([
  ...domains.supabase.redirectUrls,
  `${appOrigin}/**`,
])];

console.log('');
console.log('UniAppLab — Google sign-in setup (Supabase OAuth)');
console.log('──────────────────────────────────────────────────');
console.log('');
console.log(`  .env used: ${fs.existsSync(envPath) ? envPath : '(not found)'}`);
console.log(`  App (production): ${domains.productionOrigins.app}`);
console.log(`  App (current .env): ${appOrigin}`);
console.log('');
console.log('  1. Supabase → Authentication → URL Configuration');
console.log(`     ${supabaseAuthUrl}`);
console.log(`     Site URL: ${domains.supabase.siteUrl}`);
console.log('     Redirect URLs:');
for (const url of redirectUrls) console.log(`       ${url}`);
console.log('');
console.log('  2. Supabase → Authentication → Providers → Google');
console.log(`     ${supabaseProvidersUrl}`);
console.log('     • Toggle "Enable Google" ON');
console.log('     • Paste Google Cloud Web client ID + client secret');
console.log('     • Save (required — otherwise you get "provider is not enabled")');
console.log('');
console.log('  3. Google Cloud → OAuth Web client');
console.log(`     Redirect URI: ${supabaseCallback}`);
console.log('     JavaScript origins:');
console.log('       https://app.uniapplab.com');
console.log('       https://uniapplab.com');
console.log('       https://www.uniapplab.com');
console.log('       http://localhost:5173');
console.log('       http://localhost:3000');
console.log('');
console.log('  4. Vercel → app.uniapplab.com → set VITE_APP_ORIGIN=https://app.uniapplab.com');
console.log('  5. Local dev: http://localhost:5173 or http://localhost:3000 (pnpm dev serves both)');
console.log('  6. Verify: pnpm run auth:check');
console.log('  7. Full domain map: pnpm run domains:setup');
console.log('');

if (process.platform === 'darwin') {
  try {
    execSync(`open "${supabaseProvidersUrl}"`, { stdio: 'ignore' });
  } catch {
    /* ignore */
  }
}

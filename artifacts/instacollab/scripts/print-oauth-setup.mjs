#!/usr/bin/env node
/**
 * Print exact Google + Supabase OAuth URLs for this project.
 * Usage: pnpm run oauth:setup
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import {
  findEnvFile,
  getAppRoot,
  readEnvFile,
  supabaseProjectRefFromEnv,
} from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const envPath = findEnvFile(import.meta.dirname);
const env = readEnvFile(envPath);

const supabaseUrl = (env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseCallback = supabaseUrl
  ? `${supabaseUrl}/auth/v1/callback`
  : 'https://YOUR-PROJECT.supabase.co/auth/v1/callback';

const appOrigin = (env.VITE_APP_ORIGIN || 'http://localhost:5173').trim().replace(/\/$/, '');
const ref = supabaseProjectRefFromEnv(envPath) || 'YOUR_PROJECT_REF';
const supabaseAuthUrl = `https://supabase.com/dashboard/project/${ref}/auth/url-configuration`;
const supabaseProvidersUrl = `https://supabase.com/dashboard/project/${ref}/auth/providers?provider=Google`;

const redirectUrls = [...new Set([
  `${appOrigin}/**`,
  'http://localhost:5173/**',
  'http://127.0.0.1:5173/**',
])];

console.log('');
console.log('Google sign-in setup (Supabase OAuth)');
console.log('──────────────────────────────────────');
console.log('');
console.log(`  .env used: ${fs.existsSync(envPath) ? envPath : '(not found)'}`);
console.log(`  App origin: ${appOrigin}`);
console.log('');
console.log('  WHY "This site can\'t be reached" after Google:');
console.log('  Supabase redirects to Site URL / Redirect URLs that do not match your dev server.');
console.log('  This app runs on port 5173 — NOT 3000.');
console.log('');
console.log('  1. Supabase → Authentication → URL Configuration');
console.log(`     ${supabaseAuthUrl}`);
console.log(`     Site URL: ${appOrigin}`);
console.log('     Redirect URLs (add each):');
for (const url of redirectUrls) console.log(`       ${url}`);
console.log('');
console.log('  2. Supabase → Authentication → Providers → Google');
console.log(`     ${supabaseProvidersUrl}`);
console.log('     Enable Google + paste Web client ID + secret from Google Cloud.');
console.log('');
console.log('  3. Google Cloud → Credentials → OAuth 2.0 Web client');
console.log('     Authorized redirect URIs — add EXACTLY (not your LAN IP):');
console.log(`       ${supabaseCallback}`);
console.log('     Authorized JavaScript origins — add:');
console.log(`       ${appOrigin}`);
console.log('       http://localhost:5173');
console.log('       http://127.0.0.1:5173');
console.log('     (If testing on phone via LAN, also add e.g. http://192.168.x.x:5173)');
console.log('');
console.log('  4. Optional — lock redirect in .env (recommended):');
console.log('       VITE_APP_ORIGIN=http://localhost:5173');
console.log('     Then restart: pnpm run dev');
console.log('');
console.log('  5. Verify: pnpm run auth:check');
console.log('');

if (process.platform === 'darwin') {
  try {
    execSync(`open "${supabaseAuthUrl}"`, { stdio: 'ignore' });
    console.log('  ✓ Opened Supabase URL Configuration in your browser.');
    console.log('');
  } catch {
    /* ignore */
  }
}

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
console.log('       http://localhost:3010');
console.log('');
console.log('  3b. Google Cloud → OAuth consent screen (fixes “undefined” + unverified warning)');
console.log('     https://console.cloud.google.com/apis/credentials/consent');
console.log('     • App name: UniLive   (never leave blank — blank shows as “undefined”)');
console.log('     • User support email: uniliveofficial2026@gmail.com');
console.log('     • App logo + homepage: https://app.uniapplab.com/home/');
console.log(`     • Privacy policy:        ${domains.productionOrigins.privacy || 'https://app.uniapplab.com/privacy-policy.html'}`);
console.log(`     • Terms of service:      ${domains.productionOrigins.terms || 'https://app.uniapplab.com/terms-of-service.html'}`);
console.log('     • Authorized domains: uniapplab.com');
console.log('     • Publishing status:');
console.log('         Testing  → add every Gmail that must sign in as a Test user');
console.log('         Production → required for public users; then submit Verification');
console.log('     • Scopes on consent screen:');
console.log('         Login only: openid, email, profile');
console.log('         Workspace APIs (Gmail/Drive/Calendar/…) → submit Google verification');
console.log('           before enabling for non–test users (sensitive/restricted scopes).');
console.log('     UniLive login no longer requests Workspace scopes by default.');
console.log('     Admin Panel → Connect Google Workspace requests them incrementally.');
console.log('');
console.log('  3c. Homepage ownership (fixes “home page website is not registered to you”)');
console.log('     Verify DOMAIN property uniapplab.com in Google Search Console');
console.log('     with the SAME Google account that owns the GCP project.');
console.log('     pnpm --filter @workspace/instacollab run oauth:verify-domain');
console.log('     Then: --token=PASTE_FROM_SEARCH_CONSOLE to write Cloudflare DNS TXT.');
console.log('');
console.log('  4. Native iOS/Android (Capacitor) — add these Redirect URLs too:');
console.log('       com.uniapplab.unilive://auth/callback');
console.log('       com.uniapplab.unilive://**');
console.log('     Google opens in the system browser and returns via that deep link.');
console.log('  5. Vercel → app.uniapplab.com → set VITE_APP_ORIGIN=https://app.uniapplab.com');
console.log('  6. Local dev: http://localhost:5173 (alias http://localhost:3010)');
console.log('  7. Verify: pnpm run auth:check');
console.log('  8. Full domain map: pnpm run domains:setup');
console.log('');
console.log('  Google verification (when you need Workspace APIs for all users):');
console.log('     https://support.google.com/cloud/answer/9110914');
console.log('     Submit app verification from the OAuth consent screen → Verification Center.');
console.log('');

const firebaseProject = (env.VITE_FIREBASE_PROJECT_ID || '').trim();
const firebaseAuthDomain = (env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
const firebaseRedirectUri = firebaseAuthDomain
  ? `https://${firebaseAuthDomain.replace(/^https?:\/\//, '')}/__/auth/handler`
  : 'https://YOUR-PROJECT.firebaseapp.com/__/auth/handler';
const firebaseConsoleUrl = firebaseProject
  ? `https://console.firebase.google.com/project/${firebaseProject}/authentication/settings`
  : 'https://console.firebase.google.com/';

console.log('Firebase — OAuth backup (when Supabase /authorize is down)');
console.log('──────────────────────────────────────────────────');
console.log('');
console.log(`  Project: ${firebaseProject || '(set VITE_FIREBASE_PROJECT_ID in .env)'}`);
console.log(`  Auth domain: ${firebaseAuthDomain || '(set VITE_FIREBASE_AUTH_DOMAIN)'}`);
console.log('');
console.log('  1. Firebase Console → Authentication → Settings → Authorized domains');
console.log(`     ${firebaseConsoleUrl}`);
console.log('     Add:');
console.log('       app.uniapplab.com');
console.log('       localhost');
console.log(`       ${new URL(appOrigin).hostname}`);
console.log('');
console.log('  2. Firebase → Authentication → Sign-in method → Google (and Apple if used)');
console.log('     Enable the provider on the same Firebase project as VITE_FIREBASE_* in .env');
console.log('');
console.log('  3. Google Cloud → Credentials → Web client (Firebase auto-created)');
console.log(`     Authorized redirect URI: ${firebaseRedirectUri}`);
console.log('     Authorized JavaScript origins:');
console.log('       https://app.uniapplab.com');
console.log('       http://localhost:5173');
console.log(`       ${appOrigin}`);
console.log('');
console.log('  4. Vercel Production env — copy all VITE_FIREBASE_* from repo .env, then redeploy');
console.log('  5. Backup sign-in keeps your Supabase user id — no duplicate accounts or data loss');
console.log('');

if (process.platform === 'darwin') {
  try {
    execSync(`open "${supabaseProvidersUrl}"`, { stdio: 'ignore' });
  } catch {
    /* ignore */
  }
}

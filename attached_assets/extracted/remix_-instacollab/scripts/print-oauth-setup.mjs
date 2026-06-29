#!/usr/bin/env node
/**
 * Print exact Google OAuth URIs for this project (run after npm run dev:public).
 * Usage: node scripts/print-oauth-setup.mjs [tunnel-origin]
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tunnelOrigin = process.argv[2]?.replace(/\/$/, '');

let supabaseRedirect = 'https://kgiaflmukkguzjtmcuqd.supabase.co/auth/v1/callback';
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  const m = fs.readFileSync(envPath, 'utf8').match(/^VITE_SUPABASE_URL=(.+)$/m);
  if (m) supabaseRedirect = `${m[1].trim().replace(/\/$/, '')}/auth/v1/callback`;
}

console.log('');
console.log('Google sign-in setup (Supabase OAuth — one-time)');
console.log('──────────────────────────────────────────────');
console.log('');
console.log('The app uses Supabase for Google sign-in (stable redirect; tunnel only in JS origins).');
console.log('');
console.log('1. Supabase Dashboard → Authentication → Providers → Google → Enable');
console.log('   Use the same Google Web client ID + secret as Firebase (or create a Web client).');
console.log('2. Google Cloud → APIs & Services → Credentials → your Web OAuth client');
console.log('');
console.log('   Authorized redirect URIs — add EXACTLY (do not add trycloudflare here):');
console.log(`   ${supabaseRedirect}`);
console.log('');
console.log('   Authorized JavaScript origins — add your app URL, e.g.:');
if (tunnelOrigin) {
  console.log(`   ${tunnelOrigin}`);
} else {
  console.log('   https://YOUR-SUBDOMAIN.trycloudflare.com  (from npm run dev:public)');
}
console.log('   http://localhost:3000');
console.log('');
console.log('   WRONG: putting trycloudflare.com in Redirect URIs');
console.log('   RIGHT: trycloudflare only under JavaScript origins');
console.log('');
console.log('3. Supabase → Authentication → URL Configuration');
if (tunnelOrigin) {
  console.log(`   Site URL: ${tunnelOrigin}`);
  console.log(`   Redirect URLs: ${tunnelOrigin}/**`);
} else {
  console.log('   Add your tunnel or http://localhost:3000 (from npm run dev:public)');
}
console.log('');
console.log('4. Run migrations if you have not: npm run auth:check');
console.log('   See docs/CLOUD_AUTH.md and supabase/migrations/README.md');
console.log('');

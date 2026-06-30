#!/usr/bin/env node
/**
 * Print UniAppLab domain + Supabase + Vercel setup for production deploy.
 * Usage: pnpm run domains:setup
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  findEnvFile,
  readEnvFile,
  supabaseProjectRefFromEnv,
} from '../artifacts/instacollab/scripts/resolveProjectEnv.mjs';
const repoRoot = path.resolve(import.meta.dirname, '..');
const domainsPath = path.join(repoRoot, 'config', 'uniapplab-domains.json');
const domains = JSON.parse(fs.readFileSync(domainsPath, 'utf8'));

const envPath = findEnvFile(path.join(repoRoot, 'artifacts/instacollab/scripts'));
const env = readEnvFile(envPath);

const supabaseUrl = (env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseCallback = supabaseUrl
  ? `${supabaseUrl}/auth/v1/callback`
  : 'https://YOUR-PROJECT.supabase.co/auth/v1/callback';

const ref = supabaseProjectRefFromEnv(envPath) || 'YOUR_PROJECT_REF';
const supabaseAuthUrl = `https://supabase.com/dashboard/project/${ref}/auth/url-configuration`;

console.log('');
console.log(`${domains.brand} — domain & deploy map`);
console.log('═'.repeat(50));
console.log('');

for (const [key, host] of Object.entries(domains.hosts)) {
  const role = domains.roles[key] || '';
  const origin = domains.productionOrigins[key] || `https://${host}`;
  console.log(`  ${host.padEnd(22)} → ${role}`);
  if (domains.productionOrigins[key]) console.log(`  ${''.padEnd(22)}   ${origin}`);
}
console.log('');
console.log('Local dev (React on your Mac)');
console.log('  http://localhost:5173');
console.log('');
console.log('Vercel deploy (app.uniapplab.com)');
console.log('  1. Import repo at https://vercel.com/new');
console.log('  2. Root Directory → artifacts/instacollab');
console.log('  3. Framework → Vite (vercel.json included)');
console.log('  4. Env vars → copy from artifacts/instacollab/.env.example');
console.log('  5. Domains → add app.uniapplab.com');
console.log('');
console.log('Supabase → Authentication → URL Configuration');
console.log(`  ${supabaseAuthUrl}`);
console.log(`  Site URL: ${domains.supabase.siteUrl}`);
console.log('  Redirect URLs:');
for (const url of domains.supabase.redirectUrls) console.log(`    ${url}`);
console.log('');
console.log('Google Cloud → OAuth Web client');
console.log(`  Redirect URI: ${supabaseCallback}`);
console.log('  JavaScript origins:');
console.log('    https://app.uniapplab.com');
console.log('    https://www.uniapplab.com');
console.log('    http://localhost:5173');
console.log('');
console.log('Production .env (Vercel → Settings → Environment Variables):');
console.log('  VITE_APP_ORIGIN=https://app.uniapplab.com');
console.log('  VITE_API_URL=https://api.uniapplab.com');
console.log('  VITE_SUPABASE_URL=<your project>');
console.log('  VITE_SUPABASE_ANON_KEY=<your anon key>');
console.log('');

if (process.platform === 'darwin') {
  try {
    execSync(`open "${supabaseAuthUrl}"`, { stdio: 'ignore' });
  } catch {
    /* ignore */
  }
}

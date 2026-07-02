#!/usr/bin/env node
/**
 * Self-heal before deploy / on demand — fixes common broken production issues.
 * Usage: pnpm run heal
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'artifacts/instacollab');
const fixes = [];
const warnings = [];

function log(msg) {
  console.log(`[heal] ${msg}`);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    stdio: opts.silent ? 'pipe' : 'inherit',
    env: { ...process.env, ...opts.env },
  });
  return r.status ?? 1;
}

function readEnvKey(name) {
  for (const file of [
    path.join(APP, '.env'),
    path.join(ROOT, '.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^${name}=(.*)$`));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

// --- DeepAR assets ---
const deeparWasm = path.join(APP, 'public/deepar-resources/wasm/deepar.wasm');
const deeparZips =
  fs.existsSync(path.join(APP, 'vendor/archives/DeepAR-Web-v5.6.22.zip')) &&
  fs.existsSync(path.join(APP, 'vendor/archives/free_package.zip'));

if (!fs.existsSync(deeparWasm)) {
  log('DeepAR SDK missing — installing…');
  if (run('node', ['scripts/install-deepar-assets.mjs'], { cwd: APP }) === 0) {
    fixes.push('Installed DeepAR SDK + filter pack');
  } else if (run('node', ['scripts/sync-deepar-assets.mjs'], { cwd: APP }) === 0) {
    fixes.push('Synced DeepAR via fallback');
  } else {
    warnings.push('DeepAR install failed — add zips to vendor/archives/ or ~/Downloads/');
  }
}

// --- Supabase public config ---
log('Writing supabase-config.json…');
run('node', ['scripts/write-public-supabase-config.mjs'], { cwd: APP, silent: true });

// --- DeepAR license on Vercel (if local key exists) ---
const deeparKey = readEnvKey('VITE_DEEPAR_LICENSE_KEY');
if (deeparKey && !/your|xxxx|placeholder/i.test(deeparKey)) {
  if (process.env.HEAL_SKIP_VERCEL_ENV !== '1') {
    log('Ensuring VITE_DEEPAR_LICENSE_KEY on Vercel…');
    const envSync = run('node', ['scripts/sync-deepar-vercel-env.mjs'], { cwd: APP, silent: true });
    if (envSync === 0) fixes.push('Synced DeepAR license to Vercel');
    else warnings.push('Could not sync DeepAR license to Vercel (run deepar:env-vercel manually)');
  }
} else {
  warnings.push('VITE_DEEPAR_LICENSE_KEY missing locally — AR disabled in builds');
}

// --- Sync app env from workspace root ---
log('Syncing app env…');
run('node', ['scripts/sync-app-env.mjs'], { silent: true });

// --- Strip macOS AppleDouble from src + public ---
run('node', ['scripts/strip-appledouble.mjs', path.join(APP, 'src')], { silent: true });
const stripPublic = spawnSync('node', ['scripts/strip-appledouble.mjs', path.join(APP, 'public')], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (stripPublic.stdout?.includes('Removed') && !stripPublic.stdout.includes('Removed 0')) {
  fixes.push('Stripped macOS ._ junk from src/ and public/');
}

// --- App-wide health scan ---
log('Scanning app health…');
const health = spawnSync('node', ['scripts/check-health.mjs'], {
  cwd: APP,
  encoding: 'utf8',
  env: { ...process.env, CHECK_HEALTH_AUTOFIX: '1' },
});
if (health.stdout) process.stdout.write(health.stdout);
if (health.stderr) process.stderr.write(health.stderr);
if (health.status !== 0) {
  warnings.push('App health scan reported issues — see output above');
}

// --- Vendor archives reminder ---
if (!deeparZips) {
  warnings.push('vendor/archives/*.zip missing — Vercel builds need DeepAR zips for AR filters');
}

console.log('');
if (fixes.length) {
  console.log('Fixed:');
  for (const f of fixes) console.log(`  ✓ ${f}`);
}
if (warnings.length) {
  console.log('Warnings:');
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
if (!fixes.length && !warnings.length) console.log('Nothing to fix — all checks passed.');
console.log('');

process.exit(warnings.some((w) => w.includes('failed')) ? 1 : 0);

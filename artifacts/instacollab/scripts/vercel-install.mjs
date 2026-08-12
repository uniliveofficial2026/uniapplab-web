#!/usr/bin/env node
/**
 * Vercel install: optional vendored api-server overlay, then build + stage API.
 * Keeps vercel.json installCommand under the 256-char limit.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const INSTACOLLAB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(INSTACOLLAB, '../..');
const VENDOR = path.join(INSTACOLLAB, 'api-server-vendor');
const API_SERVER = path.join(ROOT, 'artifacts', 'api-server');

function run(cmd, args, cwd = ROOT) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false });
  if (res.status !== 0) {
    console.error(`[vercel-install] failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo') continue;
    if (entry.name.startsWith('._') || entry.name === '.env' || entry.name.startsWith('.env.')) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

run('pnpm', ['install', '--no-frozen-lockfile']);

if (fs.existsSync(path.join(VENDOR, 'src'))) {
  console.log('[vercel-install] Overlaying vendored api-server…');
  // Replace src + build entrypoints; keep existing package lock / node_modules.
  const srcVendor = path.join(VENDOR, 'src');
  const srcDest = path.join(API_SERVER, 'src');
  fs.rmSync(srcDest, { recursive: true, force: true });
  copyTree(srcVendor, srcDest);
  for (const file of ['build.mjs', 'index.js', 'tsconfig.json', 'package.json']) {
    const from = path.join(VENDOR, file);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(API_SERVER, file));
  }
}

run('pnpm', ['--filter', '@workspace/api-server', 'run', 'build']);
run('node', [path.join(INSTACOLLAB, 'scripts', 'stage-api-for-vercel.mjs')]);
console.log('[vercel-install] ✓');

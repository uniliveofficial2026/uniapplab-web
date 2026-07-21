#!/usr/bin/env node
/**
 * Build Greedy Tap production server from the external package (no source edits).
 * Output: artifacts/instacollab/.local/greedy-tap-production/
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGreedyTapPackageDir, ensureGreedyTapSymlink } from './greedy-tap-server.mjs';

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(appRoot, '.local/greedy-tap-production');

function run(cmd, args, cwd, env = process.env) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', env, shell: false });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

const packageDir = resolveGreedyTapPackageDir(appRoot);
if (!packageDir) {
  console.error('[build-greedy-tap] Package not found');
  process.exit(1);
}

ensureGreedyTapSymlink(appRoot, packageDir);

console.log('[build-greedy-tap] Installing dependencies…');
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], packageDir);

console.log('[build-greedy-tap] Building production bundle…');
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], packageDir);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const name of ['dist', 'data.json', 'package.json']) {
  const from = path.join(packageDir, name);
  if (!fs.existsSync(from)) continue;
  const to = path.join(outDir, name);
  if (fs.statSync(from).isDirectory()) {
    fs.cpSync(from, to, { recursive: true });
  } else {
    fs.copyFileSync(from, to);
  }
}

const uploadsDir = path.join(outDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const pkg = {
  name: 'greedy-tap-production',
  private: true,
  type: 'commonjs',
  scripts: {
    start:
      'NODE_ENV=production GAME_BASE_PATH=/games/greedy-slot PORT=${PORT:-3000} node dist/server.cjs',
  },
  dependencies: JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')).dependencies,
};

fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
console.log('[build-greedy-tap] Installing production runtime deps…');
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev'], outDir);

console.log(`[build-greedy-tap] ✓ ${outDir}`);

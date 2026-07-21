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

// Also sync a slim vendored runtime for Render (no Vite require at boot).
const vendorDir = path.join(appRoot, 'vendor/greedy-tap');
fs.mkdirSync(path.join(vendorDir, 'uploads'), { recursive: true });
fs.cpSync(path.join(outDir, 'dist'), path.join(vendorDir, 'dist'), { recursive: true });
const serverCjs = path.join(vendorDir, 'dist/server.cjs');
if (fs.existsSync(serverCjs)) {
  let code = fs.readFileSync(serverCjs, 'utf8');
  code = code.replace(
    /var import_vite = require\("vite"\);/,
    `var import_vite = { createServer: async () => { throw new Error("Vite is not available in Greedy Tap production builds"); } };`,
  );
  fs.writeFileSync(serverCjs, code);
}
if (fs.existsSync(path.join(outDir, 'data.json'))) {
  fs.copyFileSync(path.join(outDir, 'data.json'), path.join(vendorDir, 'data.json'));
}
fs.writeFileSync(
  path.join(vendorDir, 'package.json'),
  `${JSON.stringify(
    {
      name: 'greedy-tap-production',
      private: true,
      version: '1.0.0',
      type: 'commonjs',
      engines: { node: '>=20' },
      scripts: {
        start: 'NODE_ENV=production node dist/server.cjs',
      },
      dependencies: {
        '@google/genai': '^1.29.0',
        dotenv: '^17.2.3',
        express: '^4.21.2',
        'socket.io': '^4.8.3',
        stripe: '^22.2.0',
      },
    },
    null,
    2,
  )}\n`,
);

console.log(`[build-greedy-tap] ✓ ${outDir}`);
console.log(`[build-greedy-tap] ✓ ${vendorDir}`);

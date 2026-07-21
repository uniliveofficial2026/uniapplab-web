#!/usr/bin/env node
/**
 * Start Greedy Tap from the external package as-is (no UniLive edits to game source).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const defaultPackage = '/Volumes/Wei2TB/remix_-greedy-casino-slot';

export function greedyTapLinkPath(appRoot) {
  return path.join(appRoot, '.local/greedy-tap');
}

function zipPackageDir(appRoot) {
  return path.join(appRoot, '.local/greedy-tap-from-zip');
}

function extractGreedyZip(appRoot) {
  const zipPath = path.join(appRoot, 'public/local-games/remix_-greedy-casino-slot.zip');
  const dest = zipPackageDir(appRoot);
  if (!fs.existsSync(zipPath)) return null;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  spawnSync('unzip', ['-q', zipPath, '-d', dest], { stdio: 'inherit' });
  const entries = fs.readdirSync(dest);
  if (entries.length === 1 && fs.statSync(path.join(dest, entries[0])).isDirectory()) {
    return path.join(dest, entries[0]);
  }
  return dest;
}

export function resolveGreedyTapPackageDir(appRoot) {
  if (process.env.GREEDY_TAP_PACKAGE_DIR) {
    return path.resolve(process.env.GREEDY_TAP_PACKAGE_DIR);
  }
  const linkPath = greedyTapLinkPath(appRoot);
  if (fs.existsSync(linkPath)) {
    return fs.realpathSync(linkPath);
  }
  if (fs.existsSync(defaultPackage)) {
    return defaultPackage;
  }
  return extractGreedyZip(appRoot);
}

export function ensureGreedyTapSymlink(appRoot, targetDir) {
  const linkPath = greedyTapLinkPath(appRoot);
  const localDir = path.dirname(linkPath);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  if (!fs.existsSync(linkPath)) {
    fs.symlinkSync(targetDir, linkPath, 'dir');
    console.log(`[greedy-tap] Linked ${linkPath} → ${targetDir}`);
  }
}

export function freeGreedyTapPort(appRoot, port) {
  spawnSync('node', ['scripts/free-port.mjs', String(port)], {
    cwd: appRoot,
    stdio: 'inherit',
  });
}

export function startGreedyTapServer(appRoot, options = {}) {
  if (process.env.GREEDY_TAP_SKIP === '1') {
    return null;
  }

  const port = Number(options.port ?? process.env.GREEDY_TAP_PORT ?? '3000');
  const packageDir = resolveGreedyTapPackageDir(appRoot);
  if (!packageDir) {
    console.warn(
      '[greedy-tap] Package not found — Greedy Tap tab will stay offline until GREEDY_TAP_PACKAGE_DIR is set.',
    );
    return null;
  }

  if (!fs.existsSync(path.join(packageDir, 'package.json'))) {
    console.warn(`[greedy-tap] Invalid package (no package.json): ${packageDir}`);
    return null;
  }

  ensureGreedyTapSymlink(appRoot, packageDir);
  freeGreedyTapPort(appRoot, port);

  console.log(`[greedy-tap] Starting from ${packageDir}`);
  console.log(`[greedy-tap] Embed   http://127.0.0.1:${port}/ (bundled with pnpm dev)`);

  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: packageDir,
    stdio: options.stdio ?? 'inherit',
    env: { ...process.env, PORT: String(port) },
  });

  child.on('error', (error) => {
    console.error('[greedy-tap] Failed to start:', error.message);
  });

  return { child, port, packageDir };
}

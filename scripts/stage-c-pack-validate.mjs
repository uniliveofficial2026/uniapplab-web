#!/usr/bin/env node
/**
 * Stage C pack validation — ensures publishable @unilives packages pack cleanly
 * and do not include .env files or obvious secret artifacts.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PACKAGES = [
  'unilives-sdk',
  'unilives-cli',
  'unilives-mcp',
  'unilives-platform-core',
  'unilives-rtc-contracts',
  'unilives-rtc-core',
  'unilives-rtc-client',
  'unilives-rtc-server',
  'unilives-rtc-livekit',
  'unilives-rtc-fake',
  'unilives-rtc-qoe',
  'unilives-rtc-react',
  'unilives-auth',
  'unilives-database',
  'unilives-storage',
  'unilives-realtime',
  'unilives-deploy',
  'unilives-git',
  'unilives-observe',
  'unilives-ui',
  'unilives-errors',
  'unilives-project-graph',
  'unilives-provider-sdk',
  'unilives-plugin-sdk',
  'unilives-builder',
  'unilives-templates',
  'unilives-studio',
];

const SECRET_PATTERNS = [
  /\.env(\.|$)/i,
  /\.pem$/i,
  /id_rsa/i,
  /\.p12$/i,
  /credentials\.json$/i,
  /secrets?\./i,
  /private[-_.]?key/i,
  /\.key$/i,
];

function listPackFiles(packageDir) {
  const cwd = join(ROOT, 'lib', packageDir);
  if (!existsSync(join(cwd, 'package.json'))) {
    return { skipped: true, reason: 'missing package.json' };
  }

  let output = '';
  try {
    output = execSync('pnpm pack --dry-run', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const stderr = err.stderr?.toString?.() || err.message;
    try {
      output = execSync('npm pack --dry-run', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (npmErr) {
      throw new Error(`pack failed for ${packageDir}: ${stderr || npmErr.message}`);
    }
  }

  const files = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('npm notice') || trimmed.startsWith('Tarball Contents')) continue;
    if (trimmed.startsWith('Tarball') || trimmed.startsWith('Package:')) continue;
    const match = trimmed.match(/^(?:npm notice\s+)?(.+?)(?:\s+\d|$)/);
    const candidate = (match?.[1] || trimmed).replace(/^npm notice\s+/, '').trim();
    if (candidate && !candidate.startsWith('===') && candidate !== 'filename') {
      files.push(candidate);
    }
  }

  if (files.length === 0) {
    for (const line of output.split('\n')) {
      const m = line.match(/^\s*([\w./@-]+\.(?:mjs|js|ts|json|md))\s*$/);
      if (m) files.push(m[1]);
    }
  }

  return { skipped: false, files, raw: output };
}

let failed = 0;
const summary = [];

for (const dir of PACKAGES) {
  const result = listPackFiles(dir);
  if (result.skipped) {
    summary.push({ dir, status: 'SKIP', reason: result.reason });
    console.log(`SKIP ${dir} (${result.reason})`);
    continue;
  }

  const offenders = result.files.filter((f) => SECRET_PATTERNS.some((re) => re.test(f)));
  if (offenders.length) {
    failed += 1;
    summary.push({ dir, status: 'FAIL', offenders });
    console.error(`FAIL ${dir} secret-like paths in pack:`);
    for (const o of offenders) console.error(`  - ${o}`);
  } else {
    summary.push({ dir, status: 'PASS', fileCount: result.files.length });
    console.log(`PASS ${dir} (${result.files.length} files)`);
  }
}

if (failed) {
  console.error(`\nStage C pack validation failed: ${failed} package(s)`);
  process.exit(1);
}

console.log(`\nStage C pack validation PASS (${summary.filter((s) => s.status === 'PASS').length} packages)`);

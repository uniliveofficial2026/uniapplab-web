#!/usr/bin/env node
/**
 * Stage D pack validation — extends Stage C list with Stage D packages.
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
  'unilives-ui',
  'unilives-errors',
  'unilives-project-graph',
  'unilives-provider-sdk',
  'unilives-plugin-sdk',
  'unilives-rtc-client',
  'unilives-rtc-react',
  'unilives-cloud',
  'unilives-marketplace',
  'unilives-ai-builder',
  'unilives-selfhost',
  'unilives-release',
];

const SECRET_PATTERNS = [
  /\.env(\.|$)/i,
  /\.pem$/i,
  /id_rsa/i,
  /credentials\.json$/i,
  /private[-_.]?key/i,
];

let failed = 0;
for (const pkg of PACKAGES) {
  const cwd = join(ROOT, 'lib', pkg);
  if (!existsSync(join(cwd, 'package.json'))) {
    console.error(`FAIL missing ${pkg}`);
    failed += 1;
    continue;
  }
  let output = '';
  try {
    output = execSync('pnpm pack --dry-run', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    try {
      output = execSync('npm pack --dry-run', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e2) {
      console.error(`FAIL pack ${pkg}: ${e2.message}`);
      failed += 1;
      continue;
    }
  }
  const bad = output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => SECRET_PATTERNS.some((re) => re.test(l)));
  if (bad.length) {
    console.error(`FAIL ${pkg} secret-like pack files:`, bad.slice(0, 5));
    failed += 1;
  } else {
    console.log(`PASS pack ${pkg}`);
  }
}

if (failed) process.exit(1);
console.log('Stage D pack validation PASS');

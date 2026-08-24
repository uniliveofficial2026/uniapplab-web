#!/usr/bin/env node
/**
 * Stage C unit test runner — platform packages + pack validation.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TEST_PACKAGES = [
  'unilives-errors',
  'unilives-project-graph',
  'unilives-provider-sdk',
  'unilives-plugin-sdk',
  'unilives-sdk',
  'unilives-builder',
  'unilives-templates',
  'unilives-studio',
];

function run(label, cmd, args, cwd = ROOT) {
  const res = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
  if (res.status === 0) {
    console.log(`PASS ${label}`);
    if (res.stdout?.trim()) console.log(res.stdout.trim());
    return true;
  }
  console.error(`FAIL ${label}`);
  if (res.stdout) console.error(res.stdout);
  if (res.stderr) console.error(res.stderr);
  return false;
}

let failed = 0;

for (const pkg of TEST_PACKAGES) {
  const pkgDir = join(ROOT, 'lib', pkg);
  const testDir = join(pkgDir, 'test');
  if (!existsSync(testDir)) {
    console.error(`FAIL ${pkg} tests (missing test/)`);
    failed += 1;
    continue;
  }
  const files = readdirSync(testDir)
    .filter((f) => f.endsWith('.test.mjs'))
    .map((f) => join('test', f));
  if (!files.length) {
    console.error(`FAIL ${pkg} tests (no test files)`);
    failed += 1;
    continue;
  }
  const ok = run(`${pkg} tests`, 'node', ['--test', ...files], pkgDir);
  if (!ok) failed += 1;
}

const packOk = run('stage-c pack validation', 'node', ['scripts/stage-c-pack-validate.mjs']);
if (!packOk) failed += 1;

if (failed) {
  console.error(`\nStage C tests failed: ${failed} suite(s)`);
  process.exit(1);
}

console.log('\nStage C test suite PASS');

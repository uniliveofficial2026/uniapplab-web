#!/usr/bin/env node
/**
 * Stage D gate runner — cloud, marketplace, AI builder, self-host, release, security.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const register = join(ROOT, 'scripts/register-unilives.mjs');

const TEST_PACKAGES = [
  'unilives-release',
  'unilives-cloud',
  'unilives-marketplace',
  'unilives-ai-builder',
  'unilives-selfhost',
  'unilives-observe',
];

function run(label, cmd, args, cwd = ROOT) {
  const res = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
  if (res.status === 0) {
    console.log(`PASS ${label}`);
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
    console.error(`FAIL ${pkg} (missing test/)`);
    failed += 1;
    continue;
  }
  const files = readdirSync(testDir)
    .filter((f) => f.endsWith('.test.mjs'))
    .map((f) => join('test', f));
  const ok = run(`${pkg} tests`, 'node', ['--test', ...files], pkgDir);
  if (!ok) failed += 1;
}

const extras = [
  ['stage-d security matrix', ['--import', register, 'scripts/stage-d-security-matrix.mjs']],
  ['stage-d load harness', ['--import', register, 'scripts/stage-d-load-harness.mjs']],
  ['stage-d DR scenarios', ['--import', register, 'scripts/stage-d-dr.mjs']],
  ['stage-d release artifacts', ['--import', register, 'scripts/stage-d-release-artifacts.mjs']],
  ['stage-d pack validate', ['scripts/stage-d-pack-validate.mjs']],
  ['stage-d secret scan', ['scripts/stage-d-secret-scan.mjs']],
  ['stage-d package consumer', ['--import', register, 'scripts/stage-d-package-consumer.mjs']],
];

for (const [label, args] of extras) {
  if (!run(label, 'node', args)) failed += 1;
}

for (const ex of ['cloud-project', 'deploy', 'provider-plugin', 'ai-builder', 'self-host']) {
  const entry = join(ROOT, 'examples', ex, 'index.mjs');
  if (!existsSync(entry)) {
    console.error(`FAIL example ${ex} missing`);
    failed += 1;
    continue;
  }
  if (!run(`example ${ex}`, 'node', ['--import', register, entry])) failed += 1;
}

if (failed) {
  console.error(`\nStage D FAILED (${failed})`);
  process.exit(1);
}
console.log('\nStage D PASS');

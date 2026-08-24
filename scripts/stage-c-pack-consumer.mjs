#!/usr/bin/env node
/** Fix pack-consumer: pack tarballs + run package unit tests. */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, 'tmp', 'pack-consumer');
const PACKAGES = [
  'unilives-errors',
  'unilives-project-graph',
  'unilives-provider-sdk',
  'unilives-plugin-sdk',
  'unilives-ui',
];

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const artifacts = [];
for (const pkg of PACKAGES) {
  const cwd = join(ROOT, 'lib', pkg);
  const out = execSync('pnpm pack', { cwd, encoding: 'utf8' });
  const line = out
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.endsWith('.tgz'));
  if (!line) throw new Error(`no_tarball_${pkg}`);
  execSync(`cp "${join(cwd, line)}" "${join(TMP, line)}"`);
  artifacts.push(line);
  try {
    rmSync(join(cwd, line));
  } catch {
    /* ignore */
  }
  const tests = readdirSync(join(cwd, 'test')).filter((f) => f.endsWith('.test.mjs'));
  for (const t of tests) {
    execSync(`node --test ${join(cwd, 'test', t)}`, { stdio: 'inherit' });
  }
}

writeFileSync(join(TMP, 'manifest.json'), JSON.stringify({ ok: true, artifacts }, null, 2));
console.log(JSON.stringify({ ok: true, mode: 'pack_consumer', artifacts }, null, 2));

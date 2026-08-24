#!/usr/bin/env node
/**
 * Stage D secret scan — Stage D docs, packages, examples, release artifacts, compose.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ROOTS = [
  'docs/stage-d',
  'lib/unilives-cloud',
  'lib/unilives-marketplace',
  'lib/unilives-ai-builder',
  'lib/unilives-selfhost',
  'lib/unilives-release',
  'examples/cloud-project',
  'examples/deploy',
  'examples/provider-plugin',
  'examples/ai-builder',
  'examples/self-host',
  'scripts',
  'release',
];

const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', '.tgz']);
const EXT_OK = /\.(mjs|js|ts|tsx|md|json|yml|yaml|example|gitignore)$/i;

const LIVE_SECRET =
  /\b(sk_live_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{20,})\b/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.endsWith('.tgz')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT_OK.test(name) || name === 'docker-compose.yml') out.push(p);
  }
  return out;
}

let failed = 0;
for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    const text = readFileSync(file, 'utf8');
    if (LIVE_SECRET.test(text)) {
      console.error(`FAIL live-secret-like pattern in ${relative(ROOT, file)}`);
      failed += 1;
    }
  }
}

if (failed) {
  console.error(`Secret scan FAILED (${failed})`);
  process.exit(1);
}
console.log('Stage D secret scan PASS');

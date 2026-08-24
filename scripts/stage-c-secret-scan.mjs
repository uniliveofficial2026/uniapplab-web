#!/usr/bin/env node
/** Secret scan for Stage C paths — reports findings without printing secret values. */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const TARGETS = ['lib/unilives-', 'docs/stage-c', 'examples', 'local', 'scripts/stage-c', 'scripts/unilive', 'docs-portal'];

const PATTERNS = [
  { id: 'private_key_block', re: /-----BEGIN [A-Z ]+PRIVATE KEY-----/ },
  { id: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'slack_token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: 'generic_sk_live', re: /\bsk_live_[0-9a-zA-Z]{16,}\b/ },
  { id: 'supabase_service_role_literal', re: /service_role['\"]\s*:\s*['\"][a-zA-Z0-9._-]{40,}/ },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.generated' || name === 'dist' || name === 'tmp') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(mjs|js|ts|tsx|md|json|yml|yaml|html|css|env\.example)$/.test(name)) out.push(p);
  }
  return out;
}

const files = [];
for (const t of TARGETS) {
  if (t.endsWith('-')) {
    for (const name of readdirSync(join(ROOT, 'lib'))) {
      if (name.startsWith('unilives-')) walk(join(ROOT, 'lib', name), files);
    }
  } else walk(join(ROOT, t), files);
}

const findings = [];
for (const file of files) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      findings.push({ file: relative(ROOT, file), pattern: p.id });
    }
  }
}

const ok = findings.length === 0;
console.log(JSON.stringify({ ok, scannedFiles: files.length, findings }, null, 2));
process.exit(ok ? 0 : 1);

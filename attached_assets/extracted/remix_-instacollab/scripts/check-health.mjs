#!/usr/bin/env node
/**
 * Project health checks — run via `npm run check:health` or `npm run verify`.
 * Fails on structural/db regressions and files that exceed hard line limits.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const warnAsError = process.env.CHECK_HEALTH_STRICT === '1';

/**
 * Per-path overrides (repo-relative).
 * - default: new files must stay under error ceiling
 * - grandfathered: known large screens — error only if they grow further
 */
const LINE_LIMITS = {
  default: { warn: 900, error: 1500 },
  'src/lib/db.monolith.ts': { warn: 3700, error: 5000 },
  'src/lib/db/dbCore.ts': { warn: 1200, error: 1800 },
  'src/lib/db/domains/notifications.ts': { warn: 900, error: 1400 },
  'src/lib/db/domains/messages.ts': { warn: 900, error: 1400 },
  'src/lib/db/domains/profile.ts': { warn: 900, error: 1400 },
  'src/lib/db/domains/comments.ts': { warn: 900, error: 1400 },
  'src/components/messages/MessagesScreen.tsx': { warn: 3000, error: 3500 },
  'src/components/messages/MessagesScreenOverlays.tsx': { warn: 1000, error: 1500 },
  'src/components/feed/PostModal.tsx': { warn: 1800, error: 2200 },
  'src/components/profile/ProfileScreen.tsx': { warn: 1800, error: 2200 },
  'src/components/layout/Shell.tsx': { warn: 1400, error: 2000 },
};

const DB_REQUIRED_MARKERS = [
  'export const db',
  'class DbCore',
  'initIDB(',
  'notifyListeners(',
  'refreshFromDB(',
];

function listSourceFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      listSourceFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function rel(p) {
  return path.relative(root, p).replaceAll('\\', '/');
}

function getLimits(fileRel) {
  return LINE_LIMITS[fileRel] ?? LINE_LIMITS.default;
}

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

// --- db layer structure (catches bad merges / broken restore scripts) ---
const dbPaths = [
  path.join(root, 'src/lib/db.ts'),
  path.join(root, 'src/lib/db/localDb.ts'),
  path.join(root, 'src/lib/db/dbCore.ts'),
];
const missingDb = dbPaths.filter((p) => !fs.existsSync(p));
if (missingDb.length) {
  fail(`Missing db files: ${missingDb.map((p) => rel(p)).join(', ')}`);
} else {
  const dbSource = dbPaths.map((p) => fs.readFileSync(p, 'utf8')).join('\n');
  for (const marker of DB_REQUIRED_MARKERS) {
    if (!dbSource.includes(marker)) {
      fail(`db integrity: expected marker not found: ${marker}`);
    }
  }
  const hasDbExport =
    /export const db\s*=/.test(dbSource) &&
    (/new\s+LocalDBImpl\s*\(\s*\)/.test(dbSource) || /new\s+LocalDB\s*\(\s*\)/.test(dbSource));
  if (!hasDbExport) {
    fail('db integrity: expected db singleton export in localDb.ts');
  }
}

// --- line counts ---
const srcDir = path.join(root, 'src');
if (fs.existsSync(srcDir)) {
  for (const file of listSourceFiles(srcDir)) {
    const fileRel = rel(file);
    const lines = fs.readFileSync(file, 'utf8').split('\n').length;
    const { warn: warnAt, error: errorAt } = getLimits(fileRel);
    if (lines >= errorAt) {
      fail(`File too large (${lines} lines, max ${errorAt}): ${fileRel}`);
    } else if (lines >= warnAt) {
      warn(`File growing large (${lines} lines, warn ${warnAt}): ${fileRel}`);
    }
  }
}

// --- risky maintenance scripts in scripts/ root only (archived copies are OK) ---
const riskyScripts = ['split-db.mjs', 'restore-db-monolith.mjs'];
for (const name of riskyScripts) {
  const p = path.join(root, 'scripts', name);
  if (fs.existsSync(p)) {
    warn(
      `Maintenance script present (scripts/${name}) — do not run without a git commit and working db.ts backup. See scripts/README.md.`,
    );
  }
}

for (const w of warnings) {
  console.warn(`⚠ ${w}`);
}
for (const e of errors) {
  console.error(`✖ ${e}`);
}

if (errors.length > 0) {
  console.error(`\ncheck-health failed (${errors.length} error(s)).`);
  process.exit(1);
}

if (warnings.length > 0 && warnAsError) {
  console.error(`\ncheck-health failed (${warnings.length} warning(s) with CHECK_HEALTH_STRICT=1).`);
  process.exit(1);
}

console.log(
  warnings.length > 0
    ? `check-health passed with ${warnings.length} warning(s).`
    : 'check-health passed.',
);

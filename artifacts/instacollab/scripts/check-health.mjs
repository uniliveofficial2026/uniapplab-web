#!/usr/bin/env node
/**
 * App-wide health scan — components, URLs, media refs, db integrity, file size limits.
 * Usage: pnpm --filter @workspace/instacollab run check:health
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const warnAsError = process.env.CHECK_HEALTH_STRICT === '1';
const autofix = process.env.CHECK_HEALTH_AUTOFIX === '1';

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
  'src/components/karaoke/KaraokeScreen.tsx': { warn: 5500, error: 6500 },
  'src/components/karaoke/RecordingStudio.tsx': { warn: 4000, error: 4500 },
  'src/index.css': { warn: 1500, error: 2000 },
  'src/lib/karaokePersonSegmentation.ts': { warn: 2400, error: 2800 },
  'src/smule-rooms/pages/Room.tsx': { warn: 4200, error: 4800 },
};

const DB_REQUIRED_MARKERS = [
  'export const db',
  'class DbCore',
  'initIDB(',
  'notifyListeners(',
  'refreshFromDB(',
];

const errors = [];
const warnings = [];
const fixes = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}
function fix(msg) {
  fixes.push(msg);
}

function rel(p) {
  return path.relative(root, p).replaceAll('\\', '/');
}

function listSourceFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('._')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      listSourceFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx|css)$/.test(name)) acc.push(full);
  }
  return acc;
}

function getLimits(fileRel) {
  return LINE_LIMITS[fileRel] ?? LINE_LIMITS.default;
}

// --- db layer ---
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
    if (!dbSource.includes(marker)) fail(`db integrity: expected marker not found: ${marker}`);
  }
}

// --- line counts ---
const srcDir = path.join(root, 'src');
for (const file of listSourceFiles(srcDir)) {
  const fileRel = rel(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n').length;
  const { warn: warnAt, error: errorAt } = getLimits(fileRel);
  if (lines >= errorAt) fail(`File too large (${lines} lines, max ${errorAt}): ${fileRel}`);
  else if (lines >= warnAt) warn(`File growing large (${lines} lines, warn ${warnAt}): ${fileRel}`);
}

// --- UI / URL / media patterns in components ---
const localhostRe = /['"`]https?:\/\/localhost[:\d]/;
const emptySrcRe = /\b(src|href)=\{?\s*['"`]\s*['"`]\}?/;
const brokenPlaceholderRe =
  /(your[_-]?project[_-]?ref|VITE_[A-Z_]+=your|supabase\.co\/your|xxxx{4,}|placeholder[_-]?key)/i;

for (const file of listSourceFiles(srcDir)) {
  const fileRel = rel(file);
  if (!/\.(tsx|ts)$/.test(fileRel)) continue;
  const text = fs.readFileSync(file, 'utf8');

  if (localhostRe.test(text) && !fileRel.includes('/dev/') && !fileRel.endsWith('.test.ts')) {
    warn(`Hardcoded localhost URL in ${fileRel}`);
  }
  if (emptySrcRe.test(text)) {
    warn(`Empty src/href in ${fileRel}`);
  }
  if (brokenPlaceholderRe.test(text) && !fileRel.includes('devChangelog')) {
    warn(`Placeholder URL/key pattern in ${fileRel}`);
  }

  // Relative asset imports that don't resolve
  for (const m of text.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    const importPath = m[1];
    const base = path.dirname(file);
    const candidates = [
      path.join(base, importPath),
      `${path.join(base, importPath)}.ts`,
      `${path.join(base, importPath)}.tsx`,
      path.join(base, importPath, 'index.ts'),
      path.join(base, importPath, 'index.tsx'),
    ];
    if (!candidates.some((c) => fs.existsSync(c))) {
      warn(`Possibly broken import "${importPath}" in ${fileRel}`);
    }
  }
}

// --- public static assets referenced in code ---
const publicDir = path.join(root, 'public');
const publicFiles = new Set();
if (fs.existsSync(publicDir)) {
  function walkPublic(dir, prefix = '') {
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('._')) continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walkPublic(full, `${prefix}${name}/`);
      else publicFiles.add(`/${prefix}${name}`);
    }
  }
  walkPublic(publicDir);
}

for (const file of listSourceFiles(srcDir)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/['"`](\/(?!\/)[^'"`?\s]+)['"`]/g)) {
    const url = m[1];
    if (!url.startsWith('/')) continue;
    if (url.startsWith('/api') || url.includes('*')) continue;
    const plain = url.split('?')[0];
    if (/\.(png|jpg|jpeg|webp|svg|gif|mp4|webm|wasm|deepar|json|ico|woff2?)$/i.test(plain)) {
      if (!publicFiles.has(plain) && !plain.startsWith('/assets/') && !plain.startsWith('/effects/')) {
        warn(`Static asset may be missing: ${plain} (referenced in ${rel(file)})`);
      }
    }
  }
}

// --- index.css mobile overflow guard ---
const indexCss = path.join(root, 'src/index.css');
if (fs.existsSync(indexCss)) {
  const css = fs.readFileSync(indexCss, 'utf8');
  if (!css.includes('overflow-x') && !css.includes('overflow-x:')) {
    warn('index.css missing overflow-x guard — mobile layout may scroll horizontally');
    if (autofix) {
      fs.appendFileSync(
        indexCss,
        '\n/* auto-fix: prevent horizontal scroll on mobile */\nhtml, body, #root { max-width: 100%; overflow-x: clip; }\n',
      );
      fix('Added overflow-x clip guard to index.css');
    }
  }
}

// --- output ---
for (const f of fixes) console.log(`🔧 ${f}`);
for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);

if (errors.length > 0) {
  console.error(`\ncheck-health failed (${errors.length} error(s)).`);
  process.exit(1);
}
if (warnings.length > 0 && warnAsError) {
  console.error(`\ncheck-health failed (${warnings.length} warning(s) with CHECK_HEALTH_STRICT=1).`);
  process.exit(1);
}

console.log(
  fixes.length || warnings.length
    ? `check-health passed with ${fixes.length} fix(es), ${warnings.length} warning(s).`
    : 'check-health passed.',
);

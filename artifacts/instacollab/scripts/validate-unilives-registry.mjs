#!/usr/bin/env node
/**
 * Validates UniLive’s seed registry integrity against the public filesystem.
 * Companion to validate-unilives-manifest.mjs — reports missing files honestly.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');
const PUBLIC = join(APP_ROOT, 'public');
const SEED_PATH = join(APP_ROOT, 'src/lib/unilives-assets/seed.json');

// Prefer reading seed JSON directly (no TS transpile needed).
const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));

const issues = [];
function issue(code, message, extra = {}) {
  issues.push({ code, message, ...extra });
}

function existsPublic(urlPath) {
  if (!urlPath || !urlPath.startsWith('/')) return false;
  const abs = join(PUBLIC, urlPath.slice(1));
  return existsSync(abs) && statSync(abs).isFile();
}

const byId = new Map();
for (const asset of seed.assets || []) {
  if (byId.has(asset.id)) {
    issue('duplicate_id', `Duplicate seed ID ${asset.id}`, { assetId: asset.id });
  }
  byId.set(asset.id, asset);

  if (asset.brand !== "UniLive’s") {
    issue('invalid_brand', `Bad brand on ${asset.id}`, { assetId: asset.id });
  }
  if (!asset.formats || Object.keys(asset.formats).length === 0) {
    issue('empty_formats', `${asset.id} has empty formats`, { assetId: asset.id });
  }

  for (const [fmt, path] of Object.entries(asset.formats || {})) {
    if (!path) continue;
    if (path.startsWith('/unilives-assets/') && !existsPublic(path)) {
      issue('missing_file', `${asset.id} missing ${fmt}: ${path}`, {
        assetId: asset.id,
        path,
      });
    }
  }

  for (const key of ['fallback', 'reducedMotionFallback', 'lowPerformanceFallback', 'thumbnail', 'audio']) {
    const path = asset[key];
    if (!path) continue;
    if (!existsPublic(path)) {
      if (String(path).startsWith('/unilives-assets/')) {
        // Declared but not installed yet — report as missing_file (expected baseline).
        issue('missing_file', `${asset.id} missing ${key}: ${path}`, {
          assetId: asset.id,
          path,
        });
      } else {
        issue('broken_fallback', `${asset.id} ${key} missing: ${path}`, {
          assetId: asset.id,
          path,
        });
      }
    }
  }
}

const mappings = seed.replacementMap?.mappings || [];
for (const m of mappings) {
  if (!byId.has(m.newAssetId)) {
    issue('broken_replacement', `Unknown newAssetId ${m.newAssetId} from ${m.existingId}`, {
      assetId: m.newAssetId,
    });
  }
}

const active = new Set([
  'active',
  'wired-with-fallback',
  'wired-with-production-asset',
  'validated',
]);
const byExisting = new Map();
for (const m of mappings) {
  if (!active.has(m.status)) continue;
  const key = `${m.type || 'unknown'}::${m.existingId}`;
  const list = byExisting.get(key) || [];
  list.push(m.newAssetId);
  byExisting.set(key, list);
}
for (const [id, list] of byExisting) {
  if (new Set(list).size > 1) {
    issue('duplicate_active_mapping', `Duplicate active mappings for ${id}`, { assetId: id });
  }
}

const byCode = {};
for (const i of issues) byCode[i.code] = (byCode[i.code] || 0) + 1;

const blockingCodes = new Set([
  'duplicate_id',
  'duplicate_active_mapping',
  'broken_replacement',
  'invalid_brand',
  'empty_formats',
  'broken_fallback',
]);
const blocking = issues.filter((i) => blockingCodes.has(i.code));
const missing = issues.filter((i) => i.code === 'missing_file');

const report = {
  ok: blocking.length === 0,
  checkedAt: new Date().toISOString(),
  seedVersion: seed.version,
  totalAssets: (seed.assets || []).length,
  missingCount: (seed.assets || []).filter((a) => a.status === 'missing').length,
  issueCounts: byCode,
  blockingCount: blocking.length,
  missingFileCount: missing.length,
  blockingSample: blocking.slice(0, 20),
  notes: 'missing_file count is expected until production binaries are installed.',
};

console.log(JSON.stringify(report, null, 2));
if (blocking.length) {
  console.error(`\nFAIL: ${blocking.length} blocking seed registry issue(s).`);
  process.exit(1);
}
console.error(
  `\nPASS (structural): 0 blocking issues. Missing production files reported: ${missing.length}.`,
);
process.exit(0);

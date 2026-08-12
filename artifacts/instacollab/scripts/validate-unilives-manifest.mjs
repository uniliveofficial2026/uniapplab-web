#!/usr/bin/env node
/**
 * UniLive’s authoritative manifest + seed registry validation (local only).
 * Does not alter build behavior. Failures are reported honestly — never silenced.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');
const REPO_ROOT = join(APP_ROOT, '../..');
const PUBLIC = join(APP_ROOT, 'public');
const MANIFEST_PATH = join(PUBLIC, 'unilives-assets/manifest.json');
const SEED_PATH = join(APP_ROOT, 'src/lib/unilives-assets/seed.json');

const APPROVAL = new Set([
  'reference-only',
  'preview-pending',
  'preview-rejected',
  'preview-approved',
  'production-approved',
]);
const PRODUCTION = new Set(['missing', 'draft', 'preview', 'validated', 'installed']);
const BOARD_RE =
  /(?:^|\/|[-_])(board|turnaround|sprite-?sheet|atlas|collage)(?:\/|[-_.]|$)/i;
const SUPPORTED_RUNTIME = new Set([
  'png',
  'webp',
  'svg',
  'svga',
  'webm',
  'json',
  'audio',
  'mp3',
  'glb',
  'gltf',
]);

const issues = [];
function issue(code, message, extra = {}) {
  issues.push({ code, message, ...extra });
}

function publicFile(urlPath) {
  if (!urlPath || typeof urlPath !== 'string' || !urlPath.startsWith('/')) return null;
  const abs = join(PUBLIC, urlPath.replace(/^\//, ''));
  return existsSync(abs) && statSync(abs).isFile() ? abs : null;
}

function sha256(abs) {
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (!existsSync(MANIFEST_PATH)) {
  console.error('FAIL: missing public/unilives-assets/manifest.json');
  process.exit(2);
}
if (!existsSync(SEED_PATH)) {
  console.error('FAIL: missing seed.json');
  process.exit(2);
}

const manifest = loadJson(MANIFEST_PATH);
const seed = loadJson(SEED_PATH);

if (manifest.brand !== "UniLive’s") {
  issue('invalid_brand', `manifest.brand must be UniLive’s, got ${JSON.stringify(manifest.brand)}`);
}

const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
if (!assets.length) issue('empty_manifest', 'manifest.assets is empty');

const byId = new Map();
for (const entry of assets) {
  const id = entry.canonicalId;
  if (!id) {
    issue('missing_canonical_id', 'Asset entry missing canonicalId');
    continue;
  }
  if (byId.has(id)) {
    issue('duplicate_id', `Duplicate canonical ID: ${id}`, { assetId: id });
  }
  byId.set(id, entry);

  for (const field of [
    'displayName',
    'category',
    'subtype',
    'version',
    'approvalStatus',
    'productionStatus',
    'expectedFormat',
    'loopBehavior',
    'soundBehavior',
    'reducedMotionFallback',
  ]) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      issue('schema_missing_field', `${id} missing ${field}`, { assetId: id });
    }
  }

  if (!APPROVAL.has(entry.approvalStatus)) {
    issue('invalid_approval_status', `${id} approvalStatus=${entry.approvalStatus}`, { assetId: id });
  }
  if (!PRODUCTION.has(entry.productionStatus)) {
    issue('invalid_production_status', `${id} productionStatus=${entry.productionStatus}`, {
      assetId: id,
    });
  }

  const runtime = entry.individualRuntimePath;
  const runtimeAbs = runtime ? publicFile(runtime) : null;

  if (entry.productionStatus === 'installed' && !runtimeAbs) {
    issue(
      'production_status_inconsistent',
      `${id} marked installed but runtime file missing: ${runtime}`,
      { assetId: id, path: runtime },
    );
  }
  if (entry.productionStatus === 'installed' && entry.approvalStatus !== 'production-approved') {
    issue(
      'production_status_inconsistent',
      `${id} installed without production-approved approval`,
      { assetId: id },
    );
  }
  if (
    (entry.productionStatus === 'preview' ||
      entry.productionStatus === 'validated' ||
      entry.productionStatus === 'installed') &&
    runtime &&
    !String(runtime).startsWith('/unilives-assets/')
  ) {
    issue(
      'production_status_inconsistent',
      `${id} non-unilives path cannot be ${entry.productionStatus}: ${runtime}`,
      { assetId: id, path: runtime },
    );
  }

  if (runtime && BOARD_RE.test(runtime)) {
    issue(
      'board_registered_as_runtime',
      `${id} runtime path looks like a design board: ${runtime}`,
      { assetId: id, path: runtime },
    );
  }
  if (entry.sourceReferencePath && BOARD_RE.test(entry.sourceReferencePath)) {
    // reference path OK; fail only if also used as runtime
    if (runtime && BOARD_RE.test(runtime)) {
      issue(
        'board_registered_as_runtime',
        `${id} board reference leaked into runtime path`,
        { assetId: id },
      );
    }
  }

  const fmt = String(entry.expectedFormat || '').toLowerCase();
  if (fmt && !SUPPORTED_RUNTIME.has(fmt) && fmt !== 'n/a') {
    issue('unsupported_format', `${id} unsupported expectedFormat=${fmt}`, { assetId: id });
  }

  if (entry.checksum && runtimeAbs) {
    const actual = sha256(runtimeAbs);
    if (actual !== entry.checksum) {
      issue('checksum_mismatch', `${id} checksum mismatch`, { assetId: id, path: runtime });
    }
  } else if (entry.checksum && !runtimeAbs) {
    issue('checksum_mismatch', `${id} checksum set but file missing`, { assetId: id, path: runtime });
  }

  const fallback = entry.reducedMotionFallback || entry.fallback;
  if (fallback && !publicFile(fallback) && String(fallback).startsWith('/unilives-assets/')) {
    issue('broken_fallback', `${id} unilives fallback missing: ${fallback}`, {
      assetId: id,
      path: fallback,
    });
  }
  if (fallback && !publicFile(fallback) && String(fallback).startsWith('/')) {
    // legacy fallbacks must exist
    if (!publicFile(fallback)) {
      issue('broken_fallback', `${id} fallback path missing on disk: ${fallback}`, {
        assetId: id,
        path: fallback,
      });
    }
  }

  const needsAnim = ['gift', 'sticker', 'seat-interaction', 'avatar-ring'].includes(entry.category);
  if (
    entry.approvalStatus === 'production-approved' &&
    needsAnim &&
    !entry.animationPath &&
    !entry.previewPath
  ) {
    issue('missing_animation', `${id} production-approved animated category missing animation`, {
      assetId: id,
    });
  }
  if (
    entry.approvalStatus === 'production-approved' &&
    needsAnim &&
    entry.soundBehavior?.includes('required') &&
    !entry.audioPath
  ) {
    issue('missing_audio', `${id} production-approved requires audio`, { assetId: id });
  }
  if (
    entry.approvalStatus === 'production-approved' &&
    needsAnim &&
    !entry.previewPath
  ) {
    issue('missing_preview', `${id} production-approved missing preview path`, { assetId: id });
  }

  // Seed missing files: report (expected today)
  if (entry.seedStatus === 'missing' || entry.productionStatus === 'missing') {
    if (runtime && String(runtime).startsWith('/unilives-assets/') && !runtimeAbs) {
      issue('missing_file', `${id} missing production file: ${runtime}`, {
        assetId: id,
        path: runtime,
      });
    }
  }
}

// Seed duplicate IDs
const seedIds = new Map();
for (const a of seed.assets || []) {
  seedIds.set(a.id, (seedIds.get(a.id) || 0) + 1);
}
for (const [id, n] of seedIds) {
  if (n > 1) issue('duplicate_id', `Seed duplicate ID ${id} x${n}`, { assetId: id });
}

// Duplicate active mappings
const activeStatuses = new Set([
  'active',
  'wired-with-fallback',
  'wired-with-production-asset',
  'validated',
]);
const mapByExisting = new Map();
const mappings = manifest.replacementMap?.mappings || seed.replacementMap?.mappings || [];
for (const m of mappings) {
  if (!activeStatuses.has(m.status)) continue;
  // Business IDs may legitimately map across types (gift heart vs sticker heart).
  const key = `${m.type || 'unknown'}::${m.existingId}`;
  const list = mapByExisting.get(key) || [];
  list.push(m.newAssetId);
  mapByExisting.set(key, list);
}
for (const [key, list] of mapByExisting) {
  if (new Set(list).size > 1) {
    issue(
      'duplicate_active_mapping',
      `Multiple active mappings for ${key}: ${list.join(', ')}`,
      { assetId: key },
    );
  }
}

// Summarize
const byCode = {};
for (const i of issues) byCode[i.code] = (byCode[i.code] || 0) + 1;

const blockingCodes = new Set([
  'duplicate_id',
  'duplicate_active_mapping',
  'checksum_mismatch',
  'board_registered_as_runtime',
  'production_status_inconsistent',
  'invalid_approval_status',
  'invalid_production_status',
  'invalid_brand',
  'schema_missing_field',
  'unsupported_format',
  'broken_fallback',
]);

const blocking = issues.filter((i) => blockingCodes.has(i.code));
const expectedMissing = issues.filter((i) => i.code === 'missing_file');

const report = {
  ok: blocking.length === 0,
  checkedAt: new Date().toISOString(),
  manifestPath: relative(REPO_ROOT, MANIFEST_PATH),
  seedVersion: seed.version,
  manifestEntries: assets.length,
  seedAssets: (seed.assets || []).length,
  issueCounts: byCode,
  blockingCount: blocking.length,
  expectedMissingFileCount: expectedMissing.length,
  blockingSample: blocking.slice(0, 20),
  notes:
    'missing_file issues are expected while production binaries are absent; they are reported and not silenced.',
};

console.log(JSON.stringify(report, null, 2));

if (blocking.length) {
  console.error(
    `\nFAIL: ${blocking.length} blocking registry validation issue(s). See issueCounts.`,
  );
  process.exit(1);
}

console.error(
  `\nPASS (structural): 0 blocking issues. Expected missing production files reported: ${expectedMissing.length}.`,
);
process.exit(0);

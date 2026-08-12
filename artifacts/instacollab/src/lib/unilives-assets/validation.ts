import { LEGACY_PUBLIC_ASSETS } from './fallbacks';
import {
  getDuplicateAssetIds,
  getRegisteredAsset,
  getReplacementMap,
  listRegisteredAssets,
} from './registry';
import type {
  AssetValidationIssue,
  AssetValidationReport,
  UniLivesAsset,
} from './types';

function collectFormatPaths(asset: UniLivesAsset): string[] {
  const paths: string[] = [];
  for (const url of Object.values(asset.formats)) {
    if (url) paths.push(url);
  }
  if (asset.thumbnail) paths.push(asset.thumbnail);
  if (asset.fallback) paths.push(asset.fallback);
  if (asset.reducedMotionFallback) paths.push(asset.reducedMotionFallback);
  if (asset.lowPerformanceFallback) paths.push(asset.lowPerformanceFallback);
  if (asset.audio) paths.push(asset.audio);
  return paths;
}

/**
 * Validates the in-memory registry.
 * Browser builds cannot scan the filesystem; missing production files are
 * inferred from `status: "missing"` and empty format coverage.
 * Node/CI may pass `existingPublicPaths` (Set of URL paths that exist on disk).
 */
export function validateAssetRegistry(
  existingPublicPaths?: ReadonlySet<string>,
): AssetValidationReport {
  const assets = listRegisteredAssets();
  const issues: AssetValidationIssue[] = [];
  const duplicateIds = getDuplicateAssetIds();

  for (const id of duplicateIds) {
    issues.push({
      code: 'duplicate_id',
      assetId: id,
      message: `Duplicate asset ID: ${id}`,
    });
  }

  // Also detect duplicates by recount (in case ingest did not throw)
  const seen = new Map<string, number>();
  for (const asset of assets) {
    seen.set(asset.id, (seen.get(asset.id) ?? 0) + 1);
  }
  for (const [id, count] of seen) {
    if (count > 1 && !duplicateIds.includes(id)) {
      issues.push({
        code: 'duplicate_id',
        assetId: id,
        message: `Duplicate asset ID counted ${count} times: ${id}`,
      });
    }
  }

  for (const asset of assets) {
    if (asset.brand !== "UniLive’s") {
      issues.push({
        code: 'invalid_brand',
        assetId: asset.id,
        message: `Brand must be exactly "UniLive’s" on ${asset.id}`,
      });
    }
    if (Object.keys(asset.formats).length === 0) {
      issues.push({
        code: 'empty_formats',
        assetId: asset.id,
        message: `Asset ${asset.id} has no formats`,
      });
    }
    if (asset.status === 'missing') {
      for (const path of collectFormatPaths(asset)) {
        issues.push({
          code: 'missing_file',
          assetId: asset.id,
          path,
          message: `Production file not present (status=missing): ${path}`,
        });
      }
    } else if (existingPublicPaths) {
      for (const path of Object.values(asset.formats)) {
        if (path && !existingPublicPaths.has(path)) {
          issues.push({
            code: 'missing_file',
            assetId: asset.id,
            path,
            message: `Declared format path not found on disk: ${path}`,
          });
        }
      }
    }
  }

  const map = getReplacementMap();
  for (const mapping of map.mappings) {
    if (!getRegisteredAsset(mapping.newAssetId)) {
      issues.push({
        code: 'broken_replacement',
        assetId: mapping.newAssetId,
        message: `Replacement map points to unknown asset ${mapping.newAssetId} (from ${mapping.existingId})`,
      });
    }
  }

  const orphanPaths: string[] = [];
  // Foundation phase: no production media under unilives-assets yet → no media orphans.
  // Orphans would be files on disk under /unilives-assets not referenced by any manifest.

  const missingAssets = assets.filter((a) => a.status === 'missing');
  const duplicateList = [
    ...new Set([
      ...duplicateIds,
      ...[...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id),
    ]),
  ];

  const report: AssetValidationReport = {
    ok: duplicateList.length === 0,
    checkedAt: new Date().toISOString(),
    totalAssets: assets.length,
    productionCount: assets.filter((a) => a.status === 'production').length,
    placeholderCount: assets.filter((a) => a.status === 'placeholder').length,
    missingCount: missingAssets.length,
    deprecatedCount: assets.filter((a) => a.status === 'deprecated').length,
    duplicateIds: duplicateList,
    orphanPaths,
    existingLegacyAssetsFound: LEGACY_PUBLIC_ASSETS.length,
    issues,
  };

  return report;
}

export function listMissingAssets(): UniLivesAsset[] {
  return listRegisteredAssets().filter((a) => a.status === 'missing');
}

export function listLegacyPublicAssets() {
  return [...LEGACY_PUBLIC_ASSETS];
}

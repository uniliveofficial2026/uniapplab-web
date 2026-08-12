import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../config/env.js';
import type { ManifestAssetEntry } from '../types/assets.js';

const BOARD_RE =
  /(?:^|\/|[-_])(board|turnaround|sprite-?sheet|atlas|collage)(?:\/|[-_.]|$)/i;

export function isBoardLikePath(path: string): boolean {
  return BOARD_RE.test(path);
}

export function resolvePhysicalPath(relOrAbs: string): string {
  if (relOrAbs.startsWith('/Volumes/') || relOrAbs.startsWith('/Users/') || relOrAbs.startsWith('/')) {
    // Absolute FS path OR public URL path
    if (existsSync(relOrAbs)) return relOrAbs;
    if (relOrAbs.startsWith('/unilives-assets/') || relOrAbs.startsWith('/brand/')) {
      return join(REPO_ROOT, 'artifacts/instacollab/public', relOrAbs.replace(/^\//, ''));
    }
  }
  return join(REPO_ROOT, relOrAbs);
}

export interface ReferenceResolution {
  ok: boolean;
  canonicalId: string;
  referencePaths: string[];
  missing: string[];
  boardRejected: string[];
  notes: string[];
}

export function resolveReferencesForAsset(entry: ManifestAssetEntry): ReferenceResolution {
  const notes: string[] = [];
  const missing: string[] = [];
  const boardRejected: string[] = [];
  const referencePaths: string[] = [];

  const candidates = [
    entry.sourceReferencePath,
    typeof entry.masterPath === 'string' ? entry.masterPath : null,
  ].filter(Boolean) as string[];

  // Convention: look for APPROVED refs by canonical id under production references
  const idSafe = entry.canonicalId.replace(/\./g, '_').toUpperCase();
  const conventional = [
    join(REPO_ROOT, 'production/unilives-assets/references/branding', `URL_${idSafe}_v001_APPROVED.png`),
    join(REPO_ROOT, 'unilives_master_source/references/branding/approved', `URL_${idSafe}_v001_APPROVED.png`),
  ];

  // Brand-specific known required names from pilot stop report
  if (entry.canonicalId === 'brand.logo.primary') {
    conventional.unshift(
      join(REPO_ROOT, 'production/unilives-assets/references/branding/URL_BRAND_LOGO_PRIMARY_TRANSPARENT_v001_APPROVED.png'),
      join(REPO_ROOT, 'unilives_master_source/references/branding/approved/URL_BRAND_LOGO_PRIMARY_TRANSPARENT_v001_APPROVED.png'),
    );
  }
  if (entry.canonicalId === 'brand.logo.icon') {
    conventional.unshift(
      join(REPO_ROOT, 'production/unilives-assets/references/branding/URL_BRAND_LOGO_ICON_512_v001_APPROVED.png'),
      join(REPO_ROOT, 'unilives_master_source/references/branding/approved/URL_BRAND_LOGO_ICON_512_v001_APPROVED.png'),
    );
  }
  if (entry.canonicalId === 'brand.logo.animated' || entry.canonicalId === 'brand.splash.main') {
    conventional.unshift(
      join(REPO_ROOT, 'production/unilives-assets/references/branding/URL_BRAND_SPLASH_LAYOUT_v001_APPROVED.png'),
      join(REPO_ROOT, 'production/unilives-assets/references/branding/URL_BRAND_SPLASH_CHARACTER_STILL_v001_APPROVED.png'),
    );
  }

  for (const c of [...candidates, ...conventional]) {
    if (!c) continue;
    if (isBoardLikePath(c)) {
      boardRejected.push(c);
      continue;
    }
    const abs = resolvePhysicalPath(c);
    if (existsSync(abs)) referencePaths.push(abs);
    else missing.push(c);
  }

  // Deduplicate missing conventional paths that simply aren't present — keep unique required names
  const uniqueMissing = [...new Set(missing)];
  const uniqueRefs = [...new Set(referencePaths)];

  if (uniqueRefs.length === 0) {
    notes.push('No physical approved individual reference found');
  }

  return {
    ok: uniqueRefs.length > 0 && boardRejected.length === 0,
    canonicalId: entry.canonicalId,
    referencePaths: uniqueRefs,
    missing: uniqueMissing,
    boardRejected,
    notes,
  };
}

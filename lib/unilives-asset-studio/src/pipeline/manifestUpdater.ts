import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../config/env.js';
import type { AuthoritativeManifest, ManifestAssetEntry, ProductionStatus, ApprovalStatus } from '../types/assets.js';
import { assertNotAutoProductionApproved } from './approvalGate.js';

export const MANIFEST_PATH = join(
  REPO_ROOT,
  'artifacts/instacollab/public/unilives-assets/manifest.json',
);

export function loadManifest(): AuthoritativeManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as AuthoritativeManifest;
}

export function findManifestEntry(canonicalId: string): ManifestAssetEntry | undefined {
  const m = loadManifest();
  return m.assets.find((a) => a.canonicalId === canonicalId);
}

export function updateManifestEntry(
  canonicalId: string,
  patch: Partial<ManifestAssetEntry> & {
    approvalStatus?: ApprovalStatus;
    productionStatus?: ProductionStatus;
  },
): ManifestAssetEntry {
  if (patch.approvalStatus) assertNotAutoProductionApproved(patch.approvalStatus);
  if (patch.productionStatus) assertNotAutoProductionApproved(patch.productionStatus);
  if (patch.productionStatus === 'installed') {
    throw new Error('Refusing to set productionStatus=installed from Asset Studio');
  }
  if (patch.approvalStatus === 'production-approved') {
    throw new Error('Refusing to set approvalStatus=production-approved automatically');
  }

  const m = loadManifest();
  const idx = m.assets.findIndex((a) => a.canonicalId === canonicalId);
  if (idx < 0) throw new Error(`Unknown canonical ID in manifest: ${canonicalId}`);
  const next = { ...m.assets[idx], ...patch };
  m.assets[idx] = next;
  // recount
  m.counts = {
    ...(m.counts || {}),
    missingProduction: m.assets.filter((a) => a.productionStatus === 'missing').length,
    previewOnDisk: m.assets.filter((a) => a.productionStatus === 'preview').length,
    productionApproved: m.assets.filter((a) => a.approvalStatus === 'production-approved').length,
    installed: m.assets.filter((a) => a.productionStatus === 'installed').length,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n');
  return next;
}

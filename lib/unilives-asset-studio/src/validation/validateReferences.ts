import { loadManifest } from '../pipeline/manifestUpdater.js';
import { isBoardLikePath, resolveReferencesForAsset } from '../pipeline/referenceResolver.js';

export function validateReferences(canonicalId?: string): { ok: boolean; issues: string[] } {
  const m = loadManifest();
  const issues: string[] = [];
  const assets = canonicalId
    ? m.assets.filter((a) => a.canonicalId === canonicalId)
    : m.assets;

  for (const a of assets) {
    if (a.individualRuntimePath && isBoardLikePath(String(a.individualRuntimePath))) {
      issues.push(`${a.canonicalId}: runtime path looks like a design board`);
    }
    if (a.productionStatus === 'installed' && a.approvalStatus !== 'production-approved') {
      issues.push(`${a.canonicalId}: installed without production-approved`);
    }
    if (
      (a.productionStatus === 'preview' || a.productionStatus === 'installed') &&
      a.individualRuntimePath &&
      String(a.individualRuntimePath).startsWith('/unilives-assets/')
    ) {
      // existence checked elsewhere; here just board check
    }
  }

  if (canonicalId) {
    const entry = assets[0];
    if (!entry) issues.push(`Unknown id ${canonicalId}`);
    else {
      const r = resolveReferencesForAsset(entry);
      if (!r.ok) {
        issues.push(`${canonicalId}: approved individual reference not resolved`);
        for (const b of r.boardRejected) issues.push(`${canonicalId}: board rejected ${b}`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

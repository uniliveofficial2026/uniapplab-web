import { existsSync } from 'node:fs';
import { MANIFEST_PATH, loadManifest } from '../pipeline/manifestUpdater.js';

export function validateManifest(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!existsSync(MANIFEST_PATH)) {
    return { ok: false, issues: ['authoritative manifest.json missing'] };
  }
  const m = loadManifest();
  if (!Array.isArray(m.assets) || m.assets.length === 0) {
    issues.push('manifest.assets empty');
  }
  if (m.brand && m.brand !== "UniLive’s") {
    issues.push('manifest.brand must be UniLive’s');
  }
  const seen = new Set<string>();
  for (const a of m.assets) {
    if (!a.canonicalId) issues.push('asset missing canonicalId');
    if (seen.has(a.canonicalId)) issues.push(`duplicate canonicalId ${a.canonicalId}`);
    seen.add(a.canonicalId);
    if (a.productionStatus === 'installed' && a.approvalStatus !== 'production-approved') {
      issues.push(`${a.canonicalId}: inconsistent installed status`);
    }
  }
  return { ok: issues.length === 0, issues };
}

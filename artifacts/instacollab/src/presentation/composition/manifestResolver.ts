import { SEMANTIC_KEYS } from '../../lib/i18n/semanticCatalog';
import { validateUiManifest, type UiExperienceManifest, type ManifestValidationIssue } from './manifestSchema';
import { getBundledManifest } from './fallbackManifests';
import { getComponentMeta } from './componentRegistry';
import { BINDING_REGISTRY, type BindingId } from './bindingRegistry';

const KNOWN_KEYS = new Set(SEMANTIC_KEYS);

export type ResolvedExperience = {
  manifest: UiExperienceManifest;
  source: 'bundled' | 'cache' | 'remote';
  checksum: string;
};

export function checksumManifest(manifest: UiExperienceManifest): string {
  const json = JSON.stringify(manifest);
  let h = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a-${(h >>> 0).toString(16)}`;
}

export function resolveExperience(
  experienceKey: string,
  remote?: UiExperienceManifest | null,
  cached?: UiExperienceManifest | null,
): { ok: true; value: ResolvedExperience } | { ok: false; issues: ManifestValidationIssue[]; fallback: UiExperienceManifest } {
  const bundled = getBundledManifest(experienceKey);
  const candidates: Array<{ manifest: UiExperienceManifest; source: ResolvedExperience['source'] }> = [];
  if (remote) candidates.push({ manifest: remote, source: 'remote' });
  if (cached) candidates.push({ manifest: cached, source: 'cache' });
  if (bundled) candidates.push({ manifest: bundled, source: 'bundled' });

  for (const candidate of candidates) {
    const issues = validateUiManifest(candidate.manifest, KNOWN_KEYS);
    if (issues.length === 0) {
      return {
        ok: true,
        value: {
          manifest: candidate.manifest,
          source: candidate.source,
          checksum: checksumManifest(candidate.manifest),
        },
      };
    }
  }

  const fallback = bundled ?? getBundledManifest('home')!;
  return {
    ok: false,
    issues: validateUiManifest(remote ?? {}, KNOWN_KEYS),
    fallback,
  };
}

export function bindingAllowedForComponent(binding: BindingId, componentId: string): boolean {
  return BINDING_REGISTRY[binding].allowedComponentIds.includes(componentId) || Boolean(getComponentMeta(componentId));
}

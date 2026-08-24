import { apiFetch } from '../../lib/platformApi';
import type { UiExperienceManifest } from '../../presentation/composition/manifestSchema';
import { resolveExperience, type ResolvedExperience } from '../../presentation/composition/manifestResolver';
import { DEFAULT_THEME_TOKENS, type ThemeTokens } from '../../presentation/design-system/tokens/themeTokens';

const CACHE_PREFIX = 'unilive_ui_config_lkg::';

export type UiConfigBootstrap = {
  experiences: Record<string, UiExperienceManifest>;
  theme: ThemeTokens;
  checksum?: string;
  etag?: string;
};

function cacheKey(experienceKey: string, platform: string, appVersion: string): string {
  return `${CACHE_PREFIX}${platform}::${appVersion}::${experienceKey}`;
}

export function readLastKnownGood(experienceKey: string, platform = 'web', appVersion = '0.0.0'): UiExperienceManifest | null {
  try {
    const raw = localStorage.getItem(cacheKey(experienceKey, platform, appVersion));
    if (!raw) return null;
    return JSON.parse(raw) as UiExperienceManifest;
  } catch {
    return null;
  }
}

export function writeLastKnownGood(manifest: UiExperienceManifest, platform = 'web', appVersion = '0.0.0'): void {
  try {
    localStorage.setItem(cacheKey(manifest.experienceKey, platform, appVersion), JSON.stringify(manifest));
  } catch {
    /* quota */
  }
}

export async function fetchUiConfigBootstrap(): Promise<UiConfigBootstrap | null> {
  try {
    return await apiFetch<UiConfigBootstrap>('/api/ui-config/bootstrap');
  } catch {
    return null;
  }
}

export async function activateExperience(experienceKey: string): Promise<ResolvedExperience> {
  const cached = readLastKnownGood(experienceKey);
  const remoteBoot = await fetchUiConfigBootstrap();
  const remote = remoteBoot?.experiences?.[experienceKey] ?? null;
  const resolved = resolveExperience(experienceKey, remote, cached);
  const manifest = resolved.ok ? resolved.value.manifest : resolved.fallback;
  writeLastKnownGood(manifest);
  if (resolved.ok) return resolved.value;
  return { manifest, source: 'bundled', checksum: 'bundled' };
}

export function defaultTheme(): ThemeTokens {
  return DEFAULT_THEME_TOKENS;
}

import { getAssetFeatureFlags } from './featureFlags';
import { getAssetAudioUrl, getAssetUrl, resolveAsset } from './resolver';

const preloaded = new Set<string>();

function canUseDom(): boolean {
  return typeof document !== 'undefined' && typeof Image !== 'undefined';
}

/**
 * Best-effort preload. Does not invent files — failed loads are swallowed
 * after attempting the resolved URL / fallback.
 */
export async function preloadAsset(assetId: string): Promise<void> {
  if (preloaded.has(assetId)) return;

  const asset = resolveAsset(assetId);
  const url = getAssetUrl(assetId);
  const flags = getAssetFeatureFlags();

  if (canUseDom()) {
    const lower = url.toLowerCase();
    if (
      lower.endsWith('.png') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.svg') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg')
    ) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      });
    } else if (typeof fetch === 'function') {
      try {
        await fetch(url, { method: 'GET', cache: 'force-cache' });
      } catch {
        /* missing production file — expected during foundation */
      }
    }

    if (!flags.disableSound && asset.audio) {
      const audioUrl = getAssetAudioUrl(assetId);
      if (audioUrl && typeof fetch === 'function') {
        try {
          await fetch(audioUrl, { method: 'GET', cache: 'force-cache' });
        } catch {
          /* ignore */
        }
      }
    }
  }

  preloaded.add(assetId);
}

export async function preloadAssets(assetIds: string[]): Promise<void> {
  await Promise.all(assetIds.map((id) => preloadAsset(id)));
}

export function clearPreloadCache(): void {
  preloaded.clear();
}

export function isAssetPreloaded(assetId: string): boolean {
  return preloaded.has(assetId);
}

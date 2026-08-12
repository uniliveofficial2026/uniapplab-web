import seed from './seed.json';
import type {
  AssetManifestFile,
  AssetReplacementMapping,
  ReplacementMapFile,
  UniLivesAsset,
} from './types';
import { UNILIVES_BRAND_NAME } from './types';
import { getAssetFeatureFlags } from './featureFlags';

type SeedFile = {
  version: number;
  assets: UniLivesAsset[];
  replacementMap: ReplacementMapFile;
};

const seedData = seed as SeedFile;

const byId = new Map<string, UniLivesAsset>();
const duplicateIds = new Set<string>();

function ingest(assets: UniLivesAsset[]): void {
  for (const asset of assets) {
    if (asset.brand !== UNILIVES_BRAND_NAME) {
      throw new Error(
        `[unilives-assets] Invalid brand on ${asset.id}: expected "UniLive’s"`,
      );
    }
    if (byId.has(asset.id)) {
      duplicateIds.add(asset.id);
      if (getAssetFeatureFlags().rejectDuplicateIds) {
        throw new Error(`[unilives-assets] Duplicate asset ID rejected: ${asset.id}`);
      }
    }
    byId.set(asset.id, Object.freeze({ ...asset, formats: { ...asset.formats } }));
  }
}

ingest(seedData.assets);

let replacementMappings: AssetReplacementMapping[] = [
  ...(seedData.replacementMap?.mappings ?? []),
];

export function getRegistryVersion(): number {
  return seedData.version;
}

export function listRegisteredAssets(): UniLivesAsset[] {
  return Array.from(byId.values());
}

export function getRegisteredAsset(assetId: string): UniLivesAsset | undefined {
  return byId.get(assetId);
}

export function hasRegisteredAsset(assetId: string): boolean {
  return byId.has(assetId);
}

export function getDuplicateAssetIds(): string[] {
  return Array.from(duplicateIds);
}

export function getReplacementMap(): ReplacementMapFile {
  return {
    version: seedData.replacementMap?.version ?? 1,
    mappings: [...replacementMappings],
  };
}

export function listReplacementMappings(): AssetReplacementMapping[] {
  return [...replacementMappings];
}

export function resolveBusinessIdToAssetId(existingId: string): string | undefined {
  const hit = replacementMappings.find(
    (m) => m.existingId === existingId && m.preserveBusinessId,
  );
  return hit?.newAssetId;
}

/** Dev/CI helper: merge additional manifest payloads (rejects duplicate IDs). */
export function registerManifestAssets(manifest: AssetManifestFile): void {
  if (manifest.brand !== UNILIVES_BRAND_NAME) {
    throw new Error(`[unilives-assets] Manifest brand must be "UniLive’s"`);
  }
  ingest(manifest.assets);
}

export const PUBLIC_MANIFEST_PATHS = {
  authoritative: '/unilives-assets/manifest.json',
  brand: '/unilives-assets/manifests/brand.manifest.json',
  gifts: '/unilives-assets/manifests/gifts.manifest.json',
  stickers: '/unilives-assets/manifests/stickers.manifest.json',
  badges: '/unilives-assets/manifests/badges.manifest.json',
  rings: '/unilives-assets/manifests/rings.manifest.json',
  frames: '/unilives-assets/manifests/frames.manifest.json',
  interactions: '/unilives-assets/manifests/interactions.manifest.json',
  rooms: '/unilives-assets/manifests/rooms.manifest.json',
  sharing: '/unilives-assets/manifests/sharing.manifest.json',
  legal: '/unilives-assets/manifests/legal.manifest.json',
  index: '/unilives-assets/manifests/index.manifest.json',
  replacementMap: '/unilives-assets/manifests/replacement-map.json',
} as const;

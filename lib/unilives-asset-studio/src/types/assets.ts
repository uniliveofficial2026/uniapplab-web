export type ApprovalStatus =
  | 'reference-only'
  | 'preview-pending'
  | 'preview-rejected'
  | 'preview-approved'
  | 'production-approved';

export type ProductionStatus =
  | 'missing'
  | 'draft'
  | 'preview'
  | 'validated'
  | 'installed';

export type AssetStudioProvider =
  | 'openai'
  | 'meshy'
  | 'runway'
  | 'kling'
  | 'elevenlabs'
  | 'blender'
  | 'ffmpeg'
  | 'local';

export interface ManifestAssetEntry {
  canonicalId: string;
  displayName?: string;
  category?: string;
  approvalStatus?: ApprovalStatus;
  productionStatus?: ProductionStatus;
  sourceReferencePath?: string | null;
  individualRuntimePath?: string | null;
  masterPath?: string | null;
  previewPath?: string | null;
  audioPath?: string | null;
  animationPath?: string | null;
  reducedMotionFallback?: string | null;
  checksum?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface AuthoritativeManifest {
  brand?: string;
  schemaVersion?: number;
  seedVersion?: number;
  assets: ManifestAssetEntry[];
  counts?: Record<string, number>;
  [key: string]: unknown;
}

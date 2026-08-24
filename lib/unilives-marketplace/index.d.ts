export const MANIFEST_TYPES: ReadonlySet<string>;
export const PRIVILEGED_PERMISSIONS: ReadonlySet<string>;

export interface MarketplaceManifest {
  id: string;
  name: string;
  publisher: string;
  version: string;
  type: 'template' | 'plugin' | 'provider';
  description: string;
  capabilities: string[];
  compatibility: { platform?: string; schemaVersion?: number };
  integrity: { algorithm: string; hash: string };
  entrypoint: string;
  permissions: string[];
  metadata: Record<string, unknown>;
}

export interface ValidationOutcome {
  ok: boolean;
  errors?: string[];
  manifest?: MarketplaceManifest;
}

export function validateManifest(manifest: unknown): ValidationOutcome;
export function validateCompatibility(manifest: MarketplaceManifest, ctx?: { platformVersion?: string }): boolean;
export function computeManifestIntegrity(manifest: MarketplaceManifest): string;
export function verifyIntegrity(manifest: MarketplaceManifest): boolean;
export function validateInstallSafety(
  manifest: MarketplaceManifest,
  opts?: { grantedPermissions?: string[] },
): MarketplaceManifest;

export function createMarketplaceRegistry(options?: {
  registryDir?: string;
  seed?: boolean;
}): {
  register(manifest: MarketplaceManifest): MarketplaceManifest;
  list(filter?: { type?: string; installedOnly?: boolean }): Array<{
    id: string;
    name: string;
    publisher: string;
    version: string;
    type: string;
    description: string;
    installed: boolean;
  }>;
  search(query: string, filter?: { type?: string; installedOnly?: boolean }): ReturnType<
    ReturnType<typeof createMarketplaceRegistry>['list']
  >;
  get(id: string): MarketplaceManifest;
  install(
    id: string,
    opts?: { grantedPermissions?: string[]; installDir?: boolean },
  ): Promise<{ ok: boolean; id: string; manifest: MarketplaceManifest }>;
  remove(id: string): Promise<{ ok: boolean; id: string }>;
  validate(id: string): ValidationOutcome;
  isInstalled(id: string): boolean;
  getInstalled(): string[];
  loadFromDisk(): Promise<void>;
  listPackageFiles(id: string): Promise<string[]>;
};

export function listSeedTemplates(): Array<{ id: string; name: string; type: string }>;
export const STAGE_C_TEMPLATE_MANIFESTS: MarketplaceManifest[];

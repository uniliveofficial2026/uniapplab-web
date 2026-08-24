export const PLATFORM_VERSION: string;
export const COMPONENTS: readonly string[];

export function generateComposeTemplate(opts?: { projectName?: string }): Promise<string>;

export function initSelfHost(input: {
  dataDir: string;
  projectName?: string;
  force?: boolean;
}): Promise<{ ok: boolean; dataDir: string; configPath: string; components: string[] }>;

export function getSelfHostStatus(input: {
  dataDir: string;
  json?: boolean;
}): Promise<
  | {
      ok: boolean;
      version: string;
      projectName: string;
      initializedAt: string;
      components: Array<{ name: string; state: string }>;
      postgres: { records: number };
      tls: { note?: string; caddyReference?: string };
      human?: string;
    }
>;

export function backupSelfHost(input: {
  dataDir: string;
  outPath?: string;
}): Promise<{ ok: boolean; outPath: string; createdAt: string }>;

export function restoreSelfHost(input: {
  dataDir: string;
  backupPath: string;
  destroyExisting?: boolean;
}): Promise<{ ok: boolean; restoredAt: string; records: number }>;

export function upgradePreflight(input: {
  dataDir: string;
  targetVersion?: string;
}): Promise<{
  ok: boolean;
  currentVersion: string;
  targetVersion: string;
  blockers: string[];
  warnings: string[];
  recommended: string[];
}>;

export function destroySelfHostState(dataDir: string): Promise<{ ok: boolean }>;

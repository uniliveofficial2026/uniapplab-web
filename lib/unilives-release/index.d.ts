export const PLATFORM_VERSION: string;
export const PLATFORM_CHANNEL: string;
export function getPlatformVersionInfo(): {
  name: string;
  version: string;
  channel: string;
  stageABaseline: string;
  stageBBaseline: string;
  stageCBaseline: string;
};
export function createReleaseArtifactEntry(entry: {
  package: string;
  version?: string;
  artifact: string;
  status?: string;
  bytes?: number;
  content?: string | Buffer;
}): {
  package: string;
  version: string;
  artifact: string;
  checksum: string | null;
  bytes: number | null;
  status: string;
};
export function createReleaseManifest(artifacts?: Array<ReturnType<typeof createReleaseArtifactEntry>>): Record<string, unknown>;

import { createHash } from 'node:crypto';
import { getPlatformVersionInfo, PLATFORM_VERSION } from './version.mjs';

export * from './version.mjs';

/**
 * @param {{ package: string, version: string, artifact: string, status?: string, bytes?: number, content?: string|Buffer }} entry
 */
export function createReleaseArtifactEntry(entry) {
  const checksum = entry.content
    ? createHash('sha256').update(entry.content).digest('hex')
    : null;
  return {
    package: entry.package,
    version: entry.version || PLATFORM_VERSION,
    artifact: entry.artifact,
    checksum: checksum ? `sha256:${checksum}` : null,
    bytes: entry.bytes ?? null,
    status: entry.status || 'RELEASE_READY',
  };
}

/**
 * @param {Array<ReturnType<typeof createReleaseArtifactEntry>>} artifacts
 */
export function createReleaseManifest(artifacts = []) {
  const info = getPlatformVersionInfo();
  return {
    platform: info.name,
    version: info.version,
    channel: info.channel,
    createdAt: new Date().toISOString(),
    publicRegistryRelease: 'RELEASE_READY_EXTERNAL_STEP',
    licenseStatus: 'FORMAL_LICENSE_PENDING',
    artifacts,
    baselines: {
      stageA: info.stageABaseline,
      stageB: info.stageBBaseline,
      stageC: info.stageCBaseline,
    },
  };
}

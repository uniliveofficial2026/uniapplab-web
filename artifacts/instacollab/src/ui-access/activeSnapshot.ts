import { BUNDLED_SNAPSHOT_LOCKFILE } from './generated/checksums.generated';
import { getPinnedUiSession } from '../domain/ui-config/uiSessionDomain';
import { getActivePublicConfigVersion } from '../runtime-config/activePublicVersion';
import type { ActiveUiSession, ActiveUiSnapshot } from './types';

let snapshotCache: ActiveUiSnapshot | null = null;

export function getActiveSnapshot(): ActiveUiSnapshot {
  const pinned = getPinnedUiSession();
  const next: ActiveUiSnapshot = pinned?.lockfile
    ? {
        snapshotId: pinned.snapshotId,
        checksum: pinned.checksum,
        lockfile: pinned.lockfile as unknown as Record<string, unknown>,
      }
    : {
        snapshotId: BUNDLED_SNAPSHOT_LOCKFILE.snapshotId,
        checksum: BUNDLED_SNAPSHOT_LOCKFILE.checksum,
        lockfile: BUNDLED_SNAPSHOT_LOCKFILE as unknown as Record<string, unknown>,
      };
  if (
    snapshotCache &&
    snapshotCache.snapshotId === next.snapshotId &&
    snapshotCache.checksum === next.checksum
  ) {
    return snapshotCache;
  }
  snapshotCache = next;
  return snapshotCache;
}

export function getActiveSession(): ActiveUiSession | null {
  const pinned = getPinnedUiSession();
  if (!pinned) return null;
  const sessionType =
    pinned.sessionType === 'anonymous'
      ? 'anonymous-app'
      : pinned.sessionType === 'app'
        ? 'authenticated-app'
        : pinned.sessionType === 'live_room'
          ? 'live-room'
          : pinned.sessionType === 'admin_preview'
            ? 'admin-preview'
            : 'pk';
  return {
    sessionId: pinned.sessionId,
    sessionType,
    snapshotId: pinned.snapshotId,
    checksum: pinned.checksum,
    assignmentSource: pinned.source,
    platform: 'web',
    appVersion: '0.0.0',
    capabilityHash: 'bundled',
    assignedAt: new Date().toISOString(),
    expiresAt: pinned.expiresAt,
    publicConfigVersion: getActivePublicConfigVersion(),
  };
}

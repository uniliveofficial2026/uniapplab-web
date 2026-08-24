import { uiAccess } from './accessMapLoader';
import { BUNDLED_SNAPSHOT_LOCKFILE } from './generated/checksums.generated';

export function resolveFallbackSnapshot() {
  return {
    snapshotId: BUNDLED_SNAPSHOT_LOCKFILE.snapshotId,
    checksum: BUNDLED_SNAPSHOT_LOCKFILE.checksum,
    lockfile: BUNDLED_SNAPSHOT_LOCKFILE,
  };
}

export function resolveFallbackNode(nodeId: string) {
  const node = uiAccess.node(nodeId);
  return node.fallbackNodeId ? uiAccess.node(node.fallbackNodeId) : node;
}

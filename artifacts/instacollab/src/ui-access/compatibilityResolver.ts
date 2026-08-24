import { BUNDLED_SNAPSHOT_LOCKFILE } from './generated/checksums.generated';

export function snapshotCompatibleWithRoomType(roomType: string | null | undefined): boolean {
  if (!roomType) return true;
  const liveKeys = Object.keys(BUNDLED_SNAPSHOT_LOCKFILE.experiences).filter((k) => k.startsWith('live.'));
  if (roomType.startsWith('pk')) return liveKeys.includes('live.pk-one-v-one') || liveKeys.includes('live.pk-team');
  return liveKeys.length > 0;
}

export function snapshotCannotChangeCanonicalRoomType(): true {
  return true;
}

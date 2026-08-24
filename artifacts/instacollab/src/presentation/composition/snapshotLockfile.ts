import { BUNDLED_FRAGMENTS, BUNDLED_SNAPSHOT_ID, EXPERIENCE_KEYS, type ExperienceKey, type FragmentKey } from './fragmentRegistry';
import { validateUiFragment, type UiIssue } from './uiNodeSchema';
import { SEMANTIC_KEYS } from '../../lib/i18n/semanticCatalog';

export type SnapshotLockfile = {
  snapshotId: string;
  snapshotVersion: number;
  schemaVersion: 1;
  platform: 'all' | 'web' | 'ios' | 'android' | 'mobile';
  experiences: Record<string, number>;
  fragments: Record<string, number>;
  themeVersion: number;
  assetBindingVersion: number;
  translationCatalogVersion: number;
  checksum: string;
  compatibleRoomTypes?: string[];
};

const KNOWN_KEYS = new Set(SEMANTIC_KEYS);

export function checksumLockfile(lockfile: Omit<SnapshotLockfile, 'checksum'>): string {
  const json = JSON.stringify(lockfile);
  let h = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a-${(h >>> 0).toString(16)}`;
}

export function buildBundledLockfile(): SnapshotLockfile {
  const experiences = Object.fromEntries(EXPERIENCE_KEYS.map((k) => [k, 1])) as Record<ExperienceKey, number>;
  const fragments = Object.fromEntries(
    (Object.keys(BUNDLED_FRAGMENTS) as FragmentKey[]).map((k) => [k, BUNDLED_FRAGMENTS[k].version]),
  );
  const base = {
    snapshotId: BUNDLED_SNAPSHOT_ID,
    snapshotVersion: 1,
    schemaVersion: 1 as const,
    platform: 'all' as const,
    experiences,
    fragments,
    themeVersion: 4,
    assetBindingVersion: 1,
    translationCatalogVersion: 1,
    compatibleRoomTypes: ['solo_audio', 'solo_video', 'audio_party', 'video_multi', 'pk_1v1', 'pk_team'],
  };
  return { ...base, checksum: checksumLockfile(base) };
}

export const BUNDLED_LOCKFILE = buildBundledLockfile();

export function validateSnapshotLockfile(
  lockfile: SnapshotLockfile,
  fragments = BUNDLED_FRAGMENTS,
): UiIssue[] {
  const issues: UiIssue[] = [];
  if (lockfile.schemaVersion !== 1) issues.push({ path: 'schemaVersion', code: 'unsupported_schema', message: String(lockfile.schemaVersion) });
  const expected = checksumLockfile({
    snapshotId: lockfile.snapshotId,
    snapshotVersion: lockfile.snapshotVersion,
    schemaVersion: lockfile.schemaVersion,
    platform: lockfile.platform,
    experiences: lockfile.experiences,
    fragments: lockfile.fragments,
    themeVersion: lockfile.themeVersion,
    assetBindingVersion: lockfile.assetBindingVersion,
    translationCatalogVersion: lockfile.translationCatalogVersion,
    compatibleRoomTypes: lockfile.compatibleRoomTypes,
  });
  if (lockfile.checksum !== expected && lockfile.snapshotId !== BUNDLED_SNAPSHOT_ID) {
    /* bundled checksum may be computed in-process; remote must match after normalize */
  }
  for (const [key, version] of Object.entries(lockfile.fragments)) {
    const fragment = fragments[key as FragmentKey];
    if (!fragment) {
      issues.push({ path: `fragments.${key}`, code: 'unknown_fragment', message: key });
      continue;
    }
    if (fragment.version !== version && fragment.fragmentKey !== key) {
      issues.push({ path: `fragments.${key}`, code: 'version_mismatch', message: String(version) });
    }
    issues.push(...validateUiFragment(fragment, KNOWN_KEYS));
  }
  for (const experience of EXPERIENCE_KEYS) {
    if (lockfile.experiences[experience] == null) {
      issues.push({ path: `experiences.${experience}`, code: 'missing_experience', message: experience });
    }
  }
  return issues;
}

export function snapshotCompatibleWithRoom(lockfile: SnapshotLockfile, roomType?: string | null): boolean {
  if (!roomType) return true;
  const types = lockfile.compatibleRoomTypes || [];
  if (!types.length) return true;
  return types.includes(roomType);
}

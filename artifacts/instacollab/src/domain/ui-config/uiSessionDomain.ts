import { apiFetch } from '../../lib/platformApi';
import { ACTION_IDS } from '../../presentation/composition/actionRegistry';
import { BINDING_IDS } from '../../presentation/composition/bindingRegistry';
import { COMPONENT_IDS } from '../../presentation/composition/componentIds';
import { BUNDLED_FRAGMENTS, BUNDLED_SNAPSHOT_ID } from '../../presentation/composition/fragmentRegistry';
import { BUNDLED_LOCKFILE, type SnapshotLockfile, validateSnapshotLockfile } from '../../presentation/composition/snapshotLockfile';
import { isolateAccountSwitch } from '../identity/accountIsolation';

export type UiSessionType = 'app' | 'anonymous' | 'live_room' | 'pk' | 'admin_preview';
export type ApplyPolicy = 'next_session' | 'next_screen_entry' | 'next_room_join' | 'immediate_safe';

export type UiCapabilitySummary = {
  appVersion: string;
  platform: 'web' | 'ios' | 'android';
  schemaVersions: number[];
  componentIds: string[];
  actionIds: string[];
  bindingIds: string[];
  layoutPrimitives: string[];
  motionPresets: string[];
  assetTypes: string[];
  rtl: boolean;
};

export type PinnedUiSession = {
  sessionId: string;
  sessionType: UiSessionType;
  snapshotId: string;
  checksum: string;
  lockfile: SnapshotLockfile;
  applyPolicy: ApplyPolicy;
  expiresAt: string;
  source: string;
  locale: string;
  reducedMotion: boolean;
};

const LKG_KEY = 'unilive_ui_snapshot_lkg';
let pinned: PinnedUiSession | null = null;
let pendingSnapshot: SnapshotLockfile | null = null;
const domainCacheEpoch = { wallet: 0, chat: 0, live: 0, social: 0 };

export function capabilitySummary(input?: Partial<UiCapabilitySummary>): UiCapabilitySummary {
  return {
    appVersion: input?.appVersion || '0.0.0',
    platform: input?.platform || 'web',
    schemaVersions: [1],
    componentIds: [...COMPONENT_IDS],
    actionIds: [...ACTION_IDS],
    bindingIds: [...BINDING_IDS],
    layoutPrimitives: ['stack', 'grid', 'single'],
    motionPresets: ['fast', 'normal', 'slow', 'gift.enter'],
    assetTypes: ['png', 'webp', 'gif', 'svg', 'mp4', 'svga', 'lottie'],
    rtl: true,
    ...input,
  };
}

export function capabilityHash(summary: UiCapabilitySummary): string {
  const json = JSON.stringify({
    appVersion: summary.appVersion,
    platform: summary.platform,
    schemaVersions: summary.schemaVersions,
    components: summary.componentIds.length,
    actions: summary.actionIds.length,
    bindings: summary.bindingIds.length,
  });
  let h = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a-${(h >>> 0).toString(16)}`;
}

export function readLastKnownGoodSnapshot(): SnapshotLockfile | null {
  try {
    const raw = localStorage.getItem(LKG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SnapshotLockfile;
  } catch {
    return null;
  }
}

export function writeLastKnownGoodSnapshot(lockfile: SnapshotLockfile): void {
  try {
    localStorage.setItem(LKG_KEY, JSON.stringify(lockfile));
  } catch {
    /* quota */
  }
}

export function getPinnedUiSession(): PinnedUiSession | null {
  return pinned;
}

export function domainCacheEpochs(): typeof domainCacheEpoch {
  return { ...domainCacheEpoch };
}

export type UnsafeBoundary =
  | 'payment'
  | 'wallet'
  | 'gift'
  | 'auth'
  | 'message_send'
  | 'seat_transition'
  | 'pk_transition'
  | 'media_upload'
  | 'destructive_confirm'
  | null;

let activeUnsafe: UnsafeBoundary = null;

export function beginUnsafeUiBoundary(kind: Exclude<UnsafeBoundary, null>): void {
  activeUnsafe = kind;
}

export function endUnsafeUiBoundary(): void {
  activeUnsafe = null;
}

export function isUnsafeUiBoundary(): boolean {
  return activeUnsafe != null;
}

function activateLockfile(lockfile: SnapshotLockfile, meta: Omit<PinnedUiSession, 'lockfile'>): boolean {
  const issues = validateSnapshotLockfile(lockfile, BUNDLED_FRAGMENTS);
  if (issues.length && lockfile.snapshotId !== BUNDLED_SNAPSHOT_ID) return false;
  pinned = { ...meta, lockfile };
  writeLastKnownGoodSnapshot(lockfile);
  pendingSnapshot = null;
  return true;
}

export function applyPendingSnapshotIfSafe(boundary: 'screen_entry' | 'room_join' | 'immediate'): boolean {
  if (!pendingSnapshot || !pinned) return false;
  if (boundary === 'immediate' && isUnsafeUiBoundary()) return false;
  if (pinned.applyPolicy === 'next_screen_entry' && boundary !== 'screen_entry' && boundary !== 'immediate') return false;
  if (pinned.applyPolicy === 'next_room_join' && boundary !== 'room_join' && boundary !== 'immediate') return false;
  return activateLockfile(pendingSnapshot, {
    sessionId: pinned.sessionId,
    sessionType: pinned.sessionType,
    snapshotId: pendingSnapshot.snapshotId,
    checksum: pendingSnapshot.checksum,
    applyPolicy: pinned.applyPolicy,
    expiresAt: pinned.expiresAt,
    source: 'remote',
    locale: pinned.locale,
    reducedMotion: pinned.reducedMotion,
  });
}

export function queueSnapshotAvailable(event: {
  sessionId: string;
  snapshotId: string;
  checksum: string;
  applyPolicy: ApplyPolicy;
  lockfile?: SnapshotLockfile;
}): void {
  if (!pinned || pinned.sessionId !== event.sessionId) return;
  if (event.lockfile) pendingSnapshot = event.lockfile;
  pinned = { ...pinned, applyPolicy: event.applyPolicy };
  if (event.applyPolicy === 'immediate_safe') applyPendingSnapshotIfSafe('immediate');
}

export async function startUiSession(input: {
  sessionType: UiSessionType;
  locale: string;
  reducedMotion?: boolean;
  roomId?: string;
  roomType?: string;
  pkSessionId?: string;
  previewSnapshotId?: string;
  anonymousSessionId?: string;
  platform?: 'web' | 'ios' | 'android';
  appVersion?: string;
}): Promise<PinnedUiSession> {
  const capabilities = capabilitySummary({ platform: input.platform, appVersion: input.appVersion });
  const hash = capabilityHash(capabilities);
  const lkg = readLastKnownGoodSnapshot() || BUNDLED_LOCKFILE;
  try {
    const data = await apiFetch<{
      sessionId: string;
      sessionType: UiSessionType;
      snapshotId: string;
      checksum: string;
      lockfile: SnapshotLockfile;
      applyPolicy: ApplyPolicy;
      expiresAt: string;
      source: string;
    }>('/api/ui-sessions/start', {
      method: 'POST',
      body: JSON.stringify({
        sessionType: input.sessionType,
        platform: capabilities.platform,
        appVersion: capabilities.appVersion,
        capabilityHash: hash,
        capabilities,
        locale: input.locale,
        reducedMotion: Boolean(input.reducedMotion),
        roomId: input.roomId,
        roomType: input.roomType,
        pkSessionId: input.pkSessionId,
        previewSnapshotId: input.previewSnapshotId,
        anonymousSessionId: input.anonymousSessionId,
      }),
    });
    const lockfile = data.lockfile && validateSnapshotLockfile(data.lockfile).length === 0 ? data.lockfile : lkg;
    const next: PinnedUiSession = {
      sessionId: data.sessionId,
      sessionType: data.sessionType,
      snapshotId: data.snapshotId || lockfile.snapshotId,
      checksum: data.checksum || lockfile.checksum,
      lockfile,
      applyPolicy: data.applyPolicy || 'next_session',
      expiresAt: data.expiresAt,
      source: data.source,
      locale: input.locale,
      reducedMotion: Boolean(input.reducedMotion),
    };
    activateLockfile(lockfile, next);
    return pinned!;
  } catch {
    const offline: PinnedUiSession = {
      sessionId: crypto.randomUUID?.() || `offline-${Date.now()}`,
      sessionType: input.sessionType,
      snapshotId: lkg.snapshotId,
      checksum: lkg.checksum,
      lockfile: lkg,
      applyPolicy: 'next_session',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      source: 'lkg',
      locale: input.locale,
      reducedMotion: Boolean(input.reducedMotion),
    };
    activateLockfile(lkg, offline);
    return offline;
  }
}

export function switchAccountUiSession(): void {
  pinned = null;
  pendingSnapshot = null;
  isolateAccountSwitch();
}

export function themeChangeDoesNotInvalidateDomainCaches(): void {
  /* presentation-only: wallet/chat/live/social epochs unchanged */
}

export { BUNDLED_SNAPSHOT_ID, BUNDLED_FRAGMENTS };

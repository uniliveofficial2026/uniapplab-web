/**
 * Unified software-update status for push / deploy / publish / build channels.
 * Detects via live-version.json + PWA service worker; never forces mid-session reload.
 */
import { APP_UPDATE_STAGED_EVENT } from './invisibleReload';
import { LIVE_VERSION_UPDATED_EVENT } from './liveAutoReload';
import { isNetworkOnline } from './networkStatus';
import { checkForPwaUpdate } from './pwaAutoUpdate';
import { applyPwaUpdate, shouldRegisterPwa } from './pwaRegister';

const VERSION_URL = '/live-version.json';
const BASELINE_KEY = 'uniapplab.softwareUpdate.baselineId';
const LAST_REMOTE_KEY = 'uniapplab.softwareUpdate.lastRemote';

export type SoftwareUpdateChannel =
  | 'deploy'
  | 'push'
  | 'publish'
  | 'build'
  | 'live_sync'
  | 'update';

export type SoftwareUpdateState = 'idle' | 'checking' | 'upToDate' | 'available';

export type SoftwareUpdateSystemId = 'deployVersion' | 'pwa' | 'cloudSync';

export type SoftwareUpdateSystem = {
  id: SoftwareUpdateSystemId;
  label: string;
  status: 'active' | 'ready' | 'unavailable';
  detail: string;
};

export type LiveVersionPayload = {
  id: string;
  version: number | string | null;
  reason: string;
};

export type SoftwareUpdateStatus = {
  currentId: string;
  remoteId: string;
  reason: string;
  channel: SoftwareUpdateChannel;
  state: SoftwareUpdateState;
  checkedAt: number | null;
  pwaWaiting: boolean;
  systems: SoftwareUpdateSystem[];
};

type Listener = (status: SoftwareUpdateStatus) => void;

let currentId = '';
let remoteId = '';
let reason = '';
let channel: SoftwareUpdateChannel = 'update';
let state: SoftwareUpdateState = 'idle';
let checkedAt: number | null = null;
let pwaWaiting = false;
let listenersInstalled = false;
const listeners = new Set<Listener>();

function readStorage(key: string): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

export function normalizeUpdateChannel(raw: string | undefined | null): SoftwareUpdateChannel {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!value) return 'update';
  if (value.includes('publish')) return 'publish';
  if (value.includes('push') || value.includes('git')) return 'push';
  if (value.includes('live_sync') || value.includes('livesync')) return 'live_sync';
  if (value.includes('deploy') || value.includes('vercel') || value.includes('prod')) return 'deploy';
  if (value.includes('build')) return 'build';
  return 'update';
}

export function channelLabel(ch: SoftwareUpdateChannel): string {
  switch (ch) {
    case 'deploy':
      return 'Deploy';
    case 'push':
      return 'Push';
    case 'publish':
      return 'Publish';
    case 'build':
      return 'Build';
    case 'live_sync':
      return 'Live sync';
    default:
      return 'Update';
  }
}

function buildSystems(): SoftwareUpdateSystem[] {
  const pwaOk = shouldRegisterPwa();
  return [
    {
      id: 'deployVersion',
      label: 'Deploy version poll',
      status: 'active',
      detail: 'Watches live-version.json for push, deploy, and publish builds',
    },
    {
      id: 'pwa',
      label: 'PWA service worker',
      status: pwaOk ? (pwaWaiting ? 'ready' : 'active') : 'unavailable',
      detail: pwaOk
        ? pwaWaiting
          ? 'New build staged — restart to apply'
          : 'Background updates enabled'
        : 'Unavailable in this environment',
    },
    {
      id: 'cloudSync',
      label: 'Cloud systems',
      status: 'active',
      detail: 'Silent cloud + session sync stays live across releases',
    },
  ];
}

function computeState(): SoftwareUpdateState {
  if (state === 'checking') return 'checking';
  if (pwaWaiting) return 'available';
  if (remoteId && currentId && remoteId !== currentId) return 'available';
  if (checkedAt) return 'upToDate';
  return 'idle';
}

function snapshot(): SoftwareUpdateStatus {
  return {
    currentId,
    remoteId,
    reason,
    channel,
    state: computeState(),
    checkedAt,
    pwaWaiting,
    systems: buildSystems(),
  };
}

function emit(): void {
  const next = snapshot();
  for (const listener of listeners) {
    try {
      listener(next);
    } catch {
      /* ignore listener errors */
    }
  }
}

function ensureListeners(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;

  const baseline = readStorage(BASELINE_KEY);
  if (baseline) currentId = baseline;

  const cachedRemote = readStorage(LAST_REMOTE_KEY);
  if (cachedRemote) {
    try {
      const parsed = JSON.parse(cachedRemote) as LiveVersionPayload;
      if (parsed?.id) {
        remoteId = parsed.id;
        reason = parsed.reason || '';
        channel = normalizeUpdateChannel(parsed.reason);
        if (!currentId) {
          currentId = parsed.id;
          writeStorage(BASELINE_KEY, currentId);
        }
      }
    } catch {
      /* ignore */
    }
  }

  window.addEventListener('pwa-need-refresh', () => {
    pwaWaiting = true;
    emit();
  });

  window.addEventListener(LIVE_VERSION_UPDATED_EVENT, ((event: CustomEvent<{
    id?: string;
    version?: number | string | null;
    reason?: string;
    isNew?: boolean;
  }>) => {
    const detail = event.detail;
    if (!detail?.id) return;
    noteRemoteLiveVersion(
      {
        id: detail.id,
        version: detail.version ?? null,
        reason: detail.reason || 'deploy',
      },
      { stage: Boolean(detail.isNew) },
    );
  }) as EventListener);

  window.addEventListener(APP_UPDATE_STAGED_EVENT, ((event: CustomEvent<{ reason?: string }>) => {
    const stagedReason = event.detail?.reason;
    if (stagedReason) {
      reason = stagedReason;
      channel = normalizeUpdateChannel(stagedReason);
    }
    pwaWaiting = true;
    emit();
  }) as EventListener);
}

export function getSoftwareUpdateStatus(): SoftwareUpdateStatus {
  ensureListeners();
  return snapshot();
}

export async function fetchLiveVersion(): Promise<LiveVersionPayload | null> {
  if (typeof window === 'undefined') return null;
  if (!isNetworkOnline() && !import.meta.env.DEV) return null;
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id?: string;
      version?: number | string;
      reason?: string;
    };
    const id = String(data.id ?? data.version ?? '');
    if (!id) return null;
    return {
      id,
      version: data.version ?? null,
      reason: String(data.reason || 'update'),
    };
  } catch {
    return null;
  }
}

/**
 * Record a remote live-version payload (used by liveAutoReload + manual check).
 * First sighting sets the baseline; later different ids mark an update available.
 */
export function noteRemoteLiveVersion(payload: LiveVersionPayload, options?: { stage?: boolean }): void {
  ensureListeners();
  remoteId = payload.id;
  reason = payload.reason;
  channel = normalizeUpdateChannel(payload.reason);
  writeStorage(LAST_REMOTE_KEY, JSON.stringify(payload));

  if (!currentId) {
    currentId = payload.id;
    writeStorage(BASELINE_KEY, currentId);
  }

  checkedAt = Date.now();

  if (options?.stage && payload.id !== currentId) {
    pwaWaiting = true;
  }

  emit();
}

export async function checkSoftwareUpdate(): Promise<SoftwareUpdateStatus> {
  ensureListeners();
  state = 'checking';
  emit();

  try {
    const [payload] = await Promise.all([
      fetchLiveVersion(),
      checkForPwaUpdate().catch(() => undefined),
    ]);

    if (payload) {
      noteRemoteLiveVersion(payload, { stage: payload.id !== currentId && Boolean(currentId) });
    } else {
      checkedAt = Date.now();
    }
  } finally {
    state = 'idle';
    emit();
  }

  return getSoftwareUpdateStatus();
}

export function applySoftwareUpdate(): void {
  ensureListeners();
  if (typeof window === 'undefined') return;
  if (shouldRegisterPwa()) {
    applyPwaUpdate();
    return;
  }
  window.location.reload();
}

/** Mark the currently running page as matching the remote build (after successful apply). */
export function acknowledgeSoftwareUpdate(buildId?: string): void {
  ensureListeners();
  const id = buildId || remoteId || currentId;
  if (!id) return;
  currentId = id;
  remoteId = id;
  pwaWaiting = false;
  writeStorage(BASELINE_KEY, id);
  emit();
}

export function subscribeSoftwareUpdate(listener: Listener): () => void {
  ensureListeners();
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}

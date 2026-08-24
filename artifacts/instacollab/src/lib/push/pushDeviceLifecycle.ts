/**
 * Local persistence + auth lifecycle for push DEVICE↔PERSON bindings.
 *
 * - DEVICE installation id (`unilive_device_id`) survives logout.
 * - PERSON binding (`unilive.push.person.*`) is identity-scoped and cleared on logout.
 * - APNS/FCM tokens are never treated as person ids.
 *
 * No UI. Fail-closed when person/device/token missing.
 */

import {
  clearPushDevicePerson,
  createEmptyPushDeviceRegistry,
  registerPushDevice,
  reassignPushDevicePerson,
  resolvePersonIdForDevice,
  type PushDeviceRegistrySnapshot,
  type PushPlatform,
} from './pushDeviceRegistry';

/** Survives logout — DEVICE layer only. Same key as presence heartbeat. */
export const STABLE_DEVICE_ID_STORAGE_KEY = 'unilive_device_id';

/** PERSON-scoped binding blob — cleared via IDENTITY_SCOPED_STORAGE_PREFIXES. */
export const PUSH_PERSON_BINDING_STORAGE_KEY = 'unilive.push.person.binding.v1';

/** Prefix reserved for any future per-person push caches. */
export const PUSH_PERSON_STORAGE_PREFIX = 'unilive.push.person.';

type PersistedBinding = {
  deviceId: string;
  personId: string;
  platform: PushPlatform;
  pushToken: string;
  updatedAt: number;
};

let memoryRegistry: PushDeviceRegistrySnapshot = createEmptyPushDeviceRegistry();
/** In-memory DEVICE id when localStorage is unavailable (Node/tests). */
let cachedStableDeviceId: string | null = null;

function storageGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function storageRemove(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Stable DEVICE installation id — never a person id. */
export function getOrCreateStableDeviceId(): string {
  if (cachedStableDeviceId) return cachedStableDeviceId;
  const existing = storageGet(STABLE_DEVICE_ID_STORAGE_KEY)?.trim();
  if (existing) {
    cachedStableDeviceId = existing.slice(0, 120);
    return cachedStableDeviceId;
  }
  const next =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  storageSet(STABLE_DEVICE_ID_STORAGE_KEY, next);
  cachedStableDeviceId = next;
  return next;
}

function readPersistedBinding(): PersistedBinding | null {
  const raw = storageGet(PUSH_PERSON_BINDING_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedBinding;
    if (!parsed?.deviceId || !parsed?.personId || !parsed?.pushToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedBinding(binding: PersistedBinding | null): void {
  if (!binding) {
    storageRemove(PUSH_PERSON_BINDING_STORAGE_KEY);
    return;
  }
  storageSet(PUSH_PERSON_BINDING_STORAGE_KEY, JSON.stringify(binding));
}

function hydrateFromStorage(): void {
  const binding = readPersistedBinding();
  memoryRegistry = createEmptyPushDeviceRegistry();
  if (!binding) return;
  try {
    memoryRegistry = registerPushDevice(memoryRegistry, binding);
  } catch {
    writePersistedBinding(null);
    memoryRegistry = createEmptyPushDeviceRegistry();
  }
}

hydrateFromStorage();

export function getPushDeviceRegistrySnapshot(): PushDeviceRegistrySnapshot {
  return memoryRegistry;
}

/** Register APNS/FCM token for the signed-in PERSON on this DEVICE. */
export function registerPushTokenForCurrentPerson(input: {
  personId: string;
  pushToken: string;
  platform: PushPlatform | string;
}): { ok: true; deviceId: string } | { ok: false; reason: string } {
  const personId = String(input.personId || '').trim();
  const pushToken = String(input.pushToken || '').trim();
  if (!personId) return { ok: false, reason: 'missing_person' };
  if (!pushToken) return { ok: false, reason: 'missing_token' };

  const deviceId = getOrCreateStableDeviceId();
  try {
    memoryRegistry = registerPushDevice(memoryRegistry, {
      deviceId,
      personId,
      platform: input.platform,
      pushToken,
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'register_failed',
    };
  }

  const row = memoryRegistry.byDeviceId[deviceId];
  if (!row) return { ok: false, reason: 'register_failed' };
  writePersistedBinding({
    deviceId: row.deviceId,
    personId: row.personId,
    platform: row.platform,
    pushToken: row.pushToken,
    updatedAt: row.updatedAt,
  });
  void syncPushBindingToServer(row);
  return { ok: true, deviceId };
}

async function syncPushBindingToServer(row: PersistedBinding): Promise<void> {
  try {
    const { isPlatformApiAvailable, registerPushDeviceApi } = await import('../platformApi');
    if (!isPlatformApiAvailable()) return;
    await registerPushDeviceApi({
      deviceId: row.deviceId,
      pushToken: row.pushToken,
      platform: row.platform,
    });
  } catch {
    /* best-effort; local binding remains authoritative offline */
  }
}

async function clearPushBindingOnServer(deviceId: string): Promise<void> {
  try {
    const { isPlatformApiAvailable, clearPushDevicePersonApi } = await import('../platformApi');
    if (!isPlatformApiAvailable()) return;
    await clearPushDevicePersonApi({ deviceId });
  } catch {
    /* best-effort */
  }
}

/**
 * Login / account switch: rebind this DEVICE to the new PERSON.
 * Clears stale prior-person binding so pushes cannot target the previous account.
 */
export function rebindPushDeviceToPerson(personId: string): void {
  const nextPerson = String(personId || '').trim();
  const deviceId = getOrCreateStableDeviceId();
  if (!nextPerson) {
    clearPushPersonBindingOnLogout();
    return;
  }

  const existing = memoryRegistry.byDeviceId[deviceId] ?? readPersistedBinding();
  if (!existing?.pushToken) {
    const persisted = readPersistedBinding();
    if (persisted && persisted.personId !== nextPerson) {
      writePersistedBinding(null);
      memoryRegistry = clearPushDevicePerson(memoryRegistry, deviceId);
    }
    return;
  }

  try {
    memoryRegistry = reassignPushDevicePerson(memoryRegistry, {
      deviceId,
      personId: nextPerson,
    });
  } catch {
    memoryRegistry = clearPushDevicePerson(memoryRegistry, deviceId);
    writePersistedBinding(null);
    return;
  }

  const row = memoryRegistry.byDeviceId[deviceId];
  writePersistedBinding(
    row
      ? {
          deviceId: row.deviceId,
          personId: row.personId,
          platform: row.platform,
          pushToken: row.pushToken,
          updatedAt: row.updatedAt,
        }
      : null,
  );
}

/**
 * Logout: unbind PERSON from this DEVICE.
 * Does not delete the stable DEVICE id (multi-login on same install).
 */
export function clearPushPersonBindingOnLogout(): void {
  const deviceId = getOrCreateStableDeviceId();
  memoryRegistry = clearPushDevicePerson(memoryRegistry, deviceId);
  writePersistedBinding(null);
  void clearPushBindingOnServer(deviceId);
  try {
    if (typeof localStorage !== 'undefined') {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }
      for (const key of keys) {
        if (key.startsWith(PUSH_PERSON_STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    /* ignore */
  }
}

export function peekBoundPersonIdForThisDevice(): string | null {
  return resolvePersonIdForDevice(memoryRegistry, getOrCreateStableDeviceId());
}

/** Test helper — reset in-memory + persisted binding (keeps device id). */
export function resetPushDeviceLifecycleForTests(): void {
  memoryRegistry = createEmptyPushDeviceRegistry();
  writePersistedBinding(null);
}

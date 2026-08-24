/**
 * Push device ↔ person binding (Stage A contract).
 *
 * Invariants:
 * - DEVICE ≠ PERSON. Installation id never authenticates as a person.
 * - One DEVICE maps to at most one PERSON at a time (login reassigns).
 * - One PERSON may own many DEVICEs (multi-device).
 * - One APNS/FCM push token maps to at most one PERSON (token move reassigns).
 * - Logout clears PERSON binding on this DEVICE; DEVICE id itself survives.
 */

export type PushPlatform = 'apns' | 'fcm' | 'web_push' | 'unknown';

export type PushDeviceRegistration = {
  deviceId: string;
  personId: string;
  platform: PushPlatform;
  /** Raw provider token — never log/export from this module in production paths. */
  pushToken: string;
  updatedAt: number;
};

export type PushDeviceRegistrySnapshot = {
  byDeviceId: Record<string, PushDeviceRegistration>;
  /** pushToken → deviceId (enforces token uniqueness). */
  deviceIdByToken: Record<string, string>;
};

export function createEmptyPushDeviceRegistry(): PushDeviceRegistrySnapshot {
  return { byDeviceId: {}, deviceIdByToken: {} };
}

function norm(id: string): string {
  return String(id || '').trim();
}

/** DEVICE must never be treated as PERSON primary key. */
export function assertDeviceIsNotPerson(deviceId: string, personId: string): void {
  const d = norm(deviceId);
  const p = norm(personId);
  if (!d || !p) {
    throw new Error('push_registry: deviceId and personId are required');
  }
  if (d === p) {
    throw new Error('push_registry: DEVICE must not equal PERSON');
  }
}

export function normalizePushPlatform(raw: string | null | undefined): PushPlatform {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'apns' || v === 'ios' || v === 'apple') return 'apns';
  if (v === 'fcm' || v === 'android' || v === 'firebase') return 'fcm';
  if (v === 'web_push' || v === 'web' || v === 'webpush') return 'web_push';
  return 'unknown';
}

/**
 * Register or refresh a push token for (device, person).
 * Reassigns the device away from any prior person and moves the token
 * away from any prior device.
 */
export function registerPushDevice(
  registry: PushDeviceRegistrySnapshot,
  input: {
    deviceId: string;
    personId: string;
    platform: PushPlatform | string;
    pushToken: string;
    now?: number;
  },
): PushDeviceRegistrySnapshot {
  const deviceId = norm(input.deviceId);
  const personId = norm(input.personId);
  const pushToken = norm(input.pushToken);
  assertDeviceIsNotPerson(deviceId, personId);
  if (!pushToken) throw new Error('push_registry: pushToken is required');

  const platform = normalizePushPlatform(input.platform);
  const now = input.now ?? Date.now();
  const next: PushDeviceRegistrySnapshot = {
    byDeviceId: { ...registry.byDeviceId },
    deviceIdByToken: { ...registry.deviceIdByToken },
  };

  // Token uniqueness: detach from previous device if the token moved.
  const priorDeviceForToken = next.deviceIdByToken[pushToken];
  if (priorDeviceForToken && priorDeviceForToken !== deviceId) {
    const prior = next.byDeviceId[priorDeviceForToken];
    if (prior) {
      delete next.deviceIdByToken[prior.pushToken];
      delete next.byDeviceId[priorDeviceForToken];
    }
  }

  // Device reassignment: drop old token index for this device.
  const existing = next.byDeviceId[deviceId];
  if (existing && existing.pushToken !== pushToken) {
    delete next.deviceIdByToken[existing.pushToken];
  }

  const row: PushDeviceRegistration = {
    deviceId,
    personId,
    platform,
    pushToken,
    updatedAt: now,
  };
  next.byDeviceId[deviceId] = row;
  next.deviceIdByToken[pushToken] = deviceId;
  return next;
}

/** Login / account-switch: bind this device to the new person (keeps token if present). */
export function reassignPushDevicePerson(
  registry: PushDeviceRegistrySnapshot,
  input: { deviceId: string; personId: string; now?: number },
): PushDeviceRegistrySnapshot {
  const deviceId = norm(input.deviceId);
  const personId = norm(input.personId);
  assertDeviceIsNotPerson(deviceId, personId);
  const existing = registry.byDeviceId[deviceId];
  if (!existing) {
    // No token yet — nothing to reassign in the token map.
    return registry;
  }
  return registerPushDevice(registry, {
    deviceId,
    personId,
    platform: existing.platform,
    pushToken: existing.pushToken,
    now: input.now,
  });
}

/**
 * Logout: clear PERSON binding for this DEVICE.
 * DEVICE id and other persons' devices are untouched.
 */
export function clearPushDevicePerson(
  registry: PushDeviceRegistrySnapshot,
  deviceId: string,
): PushDeviceRegistrySnapshot {
  const id = norm(deviceId);
  const existing = registry.byDeviceId[id];
  if (!existing) return registry;
  const next: PushDeviceRegistrySnapshot = {
    byDeviceId: { ...registry.byDeviceId },
    deviceIdByToken: { ...registry.deviceIdByToken },
  };
  delete next.deviceIdByToken[existing.pushToken];
  delete next.byDeviceId[id];
  return next;
}

/** Resolve PERSON for a provider token (APNS/FCM). null if unbound. */
export function resolvePersonIdForPushToken(
  registry: PushDeviceRegistrySnapshot,
  pushToken: string,
): string | null {
  const token = norm(pushToken);
  if (!token) return null;
  const deviceId = registry.deviceIdByToken[token];
  if (!deviceId) return null;
  return registry.byDeviceId[deviceId]?.personId ?? null;
}

/** Resolve PERSON currently bound to a DEVICE. */
export function resolvePersonIdForDevice(
  registry: PushDeviceRegistrySnapshot,
  deviceId: string,
): string | null {
  return registry.byDeviceId[norm(deviceId)]?.personId ?? null;
}

/** All devices currently bound to a PERSON (multi-device). */
export function listDevicesForPerson(
  registry: PushDeviceRegistrySnapshot,
  personId: string,
): PushDeviceRegistration[] {
  const pid = norm(personId);
  return Object.values(registry.byDeviceId).filter((row) => row.personId === pid);
}

/** Whether a stale PERSON remains bound to this DEVICE after logout (bug detector). */
export function hasStalePersonBinding(
  registry: PushDeviceRegistrySnapshot,
  deviceId: string,
  expectedPersonId: string | null,
): boolean {
  const bound = resolvePersonIdForDevice(registry, deviceId);
  if (!expectedPersonId) return bound != null;
  return bound != null && bound !== norm(expectedPersonId);
}

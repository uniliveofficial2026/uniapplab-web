/**
 * Stage A contract: push DEVICE registration vs PERSON identity.
 * Run: node --import tsx --test test/push-device-identity.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertDeviceIsNotPerson,
  clearPushDevicePerson,
  createEmptyPushDeviceRegistry,
  hasStalePersonBinding,
  listDevicesForPerson,
  reassignPushDevicePerson,
  registerPushDevice,
  resolvePersonIdForDevice,
  resolvePersonIdForPushToken,
} from '../src/lib/push/pushDeviceRegistry.ts';
import {
  PUSH_PERSON_STORAGE_PREFIX,
  STABLE_DEVICE_ID_STORAGE_KEY,
  clearPushPersonBindingOnLogout,
  getOrCreateStableDeviceId,
  peekBoundPersonIdForThisDevice,
  rebindPushDeviceToPerson,
  registerPushTokenForCurrentPerson,
  resetPushDeviceLifecycleForTests,
} from '../src/lib/push/pushDeviceLifecycle.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('DEVICE must never equal PERSON', () => {
  assert.throws(() => assertDeviceIsNotPerson('same-id', 'same-id'), /DEVICE must not equal PERSON/);
  assert.doesNotThrow(() => assertDeviceIsNotPerson('device-1', 'person-1'));
});

test('register binds APNS/FCM token to PERSON via DEVICE (not as person id)', () => {
  let reg = createEmptyPushDeviceRegistry();
  reg = registerPushDevice(reg, {
    deviceId: 'phone-a',
    personId: 'user-alice',
    platform: 'apns',
    pushToken: 'apns-token-1',
  });
  assert.equal(resolvePersonIdForDevice(reg, 'phone-a'), 'user-alice');
  assert.equal(resolvePersonIdForPushToken(reg, 'apns-token-1'), 'user-alice');
  assert.notEqual(resolvePersonIdForPushToken(reg, 'apns-token-1'), 'phone-a');
});

test('login reassignment moves DEVICE to new PERSON; prior person loses this device', () => {
  let reg = createEmptyPushDeviceRegistry();
  reg = registerPushDevice(reg, {
    deviceId: 'phone-a',
    personId: 'user-alice',
    platform: 'fcm',
    pushToken: 'fcm-token-1',
  });
  reg = reassignPushDevicePerson(reg, { deviceId: 'phone-a', personId: 'user-bob' });
  assert.equal(resolvePersonIdForDevice(reg, 'phone-a'), 'user-bob');
  assert.equal(listDevicesForPerson(reg, 'user-alice').length, 0);
  assert.equal(listDevicesForPerson(reg, 'user-bob').length, 1);
  assert.equal(resolvePersonIdForPushToken(reg, 'fcm-token-1'), 'user-bob');
});

test('logout clears PERSON on DEVICE; DEVICE id remains reusable', () => {
  let reg = createEmptyPushDeviceRegistry();
  reg = registerPushDevice(reg, {
    deviceId: 'phone-a',
    personId: 'user-alice',
    platform: 'apns',
    pushToken: 'apns-token-2',
  });
  reg = clearPushDevicePerson(reg, 'phone-a');
  assert.equal(resolvePersonIdForDevice(reg, 'phone-a'), null);
  assert.equal(resolvePersonIdForPushToken(reg, 'apns-token-2'), null);
  assert.equal(hasStalePersonBinding(reg, 'phone-a', null), false);
});

test('multi-device: one PERSON may own many DEVICEs; logout one leaves others', () => {
  let reg = createEmptyPushDeviceRegistry();
  reg = registerPushDevice(reg, {
    deviceId: 'phone',
    personId: 'user-alice',
    platform: 'apns',
    pushToken: 'tok-phone',
  });
  reg = registerPushDevice(reg, {
    deviceId: 'tablet',
    personId: 'user-alice',
    platform: 'fcm',
    pushToken: 'tok-tablet',
  });
  assert.equal(listDevicesForPerson(reg, 'user-alice').length, 2);
  reg = clearPushDevicePerson(reg, 'phone');
  assert.equal(resolvePersonIdForDevice(reg, 'phone'), null);
  assert.equal(resolvePersonIdForDevice(reg, 'tablet'), 'user-alice');
  assert.equal(listDevicesForPerson(reg, 'user-alice').length, 1);
});

test('APNS/FCM token uniqueness: token move reassigns to the new DEVICE/PERSON', () => {
  let reg = createEmptyPushDeviceRegistry();
  reg = registerPushDevice(reg, {
    deviceId: 'old-phone',
    personId: 'user-alice',
    platform: 'apns',
    pushToken: 'shared-token',
  });
  reg = registerPushDevice(reg, {
    deviceId: 'new-phone',
    personId: 'user-bob',
    platform: 'apns',
    pushToken: 'shared-token',
  });
  assert.equal(resolvePersonIdForPushToken(reg, 'shared-token'), 'user-bob');
  assert.equal(resolvePersonIdForDevice(reg, 'old-phone'), null);
  assert.equal(resolvePersonIdForDevice(reg, 'new-phone'), 'user-bob');
});

test('lifecycle: register → account switch → logout clears stale person on device', () => {
  resetPushDeviceLifecycleForTests();
  const deviceId = getOrCreateStableDeviceId();
  assert.ok(deviceId);
  assert.notEqual(deviceId, 'user-alice');

  const registered = registerPushTokenForCurrentPerson({
    personId: 'user-alice',
    pushToken: 'lifecycle-token',
    platform: 'fcm',
  });
  assert.equal(registered.ok, true);
  assert.equal(peekBoundPersonIdForThisDevice(), 'user-alice');

  rebindPushDeviceToPerson('user-bob');
  assert.equal(peekBoundPersonIdForThisDevice(), 'user-bob');

  clearPushPersonBindingOnLogout();
  assert.equal(peekBoundPersonIdForThisDevice(), null);
  // DEVICE installation id survives logout
  assert.equal(getOrCreateStableDeviceId(), deviceId);
});

test('wiring: logout clears push person; account switch rebinds; device id not identity-scoped', () => {
  const handoff = read('src/lib/auth/authHandoff.ts');
  assert.match(handoff, /clearPushPersonBindingOnLogout/);
  assert.match(handoff, /postPresenceOffline/);

  const accountSwitch = read('src/lib/auth/accountSwitchFast.ts');
  assert.match(accountSwitch, /rebindPushDeviceToPerson/);

  const identity = read('src/lib/identity/canonicalIdentity.ts');
  assert.match(identity, /unilive\.push\.person\./);
  assert.doesNotMatch(
    identity,
    new RegExp(STABLE_DEVICE_ID_STORAGE_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );

  const notif = read('src/lib/cloudNotificationSync.ts');
  assert.match(notif, /subscribedUserId && subscribedUserId !== meId/);

  const live = read('src/lib/liveCloudSurfaces.ts');
  assert.match(live, /postPresenceOffline/);

  assert.equal(PUSH_PERSON_STORAGE_PREFIX.startsWith('unilive.push.person.'), true);
  assert.equal(STABLE_DEVICE_ID_STORAGE_KEY, 'unilive_device_id');
});

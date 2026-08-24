import test from 'node:test';
import assert from 'node:assert/strict';
import {
  asPersonId,
  isHiddenWatcherIdentity,
  isLiveKitParticipantSid,
  personIdFromRtcIdentity,
  IDENTITY_SCOPED_STORAGE_PREFIXES,
} from '../src/lib/identity/canonicalIdentity.ts';

test('PERSON brand helper trims', () => {
  assert.equal(asPersonId('  user-1  '), 'user-1');
});

test('LiveKit participant SID is not PERSON', () => {
  assert.equal(isLiveKitParticipantSid('PA_abcdefghijkl'), true);
  assert.equal(personIdFromRtcIdentity('PA_abcdefghijkl'), null);
});

test('hidden watcher identities are not roster people', () => {
  assert.equal(isHiddenWatcherIdentity('aw_secret'), true);
  assert.equal(personIdFromRtcIdentity('aw_secret'), null);
});

test('normal RTC identity maps to person id', () => {
  assert.equal(personIdFromRtcIdentity('supabase-user-uuid'), 'supabase-user-uuid');
});

test('logout clearance prefixes cover auth/session/wallet/push person', () => {
  const joined = IDENTITY_SCOPED_STORAGE_PREFIXES.join(' ');
  assert.match(joined, /auth/);
  assert.match(joined, /session/);
  assert.match(joined, /wallet/);
  assert.match(joined, /push\.person/);
});

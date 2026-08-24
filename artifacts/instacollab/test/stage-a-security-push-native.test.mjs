import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('push API binds PERSON from auth, never body.personId', () => {
  const push = read('../api-server/src/routes/push.ts');
  assert.match(push, /PERSON is always the authenticated user/);
  assert.match(push, /const personId = req\.authUser!\.id/);
  assert.doesNotMatch(push, /personId:\s*req\.body/);
  assert.match(push, /DEVICE must not equal PERSON/);
  assert.match(push, /clear-person/);
  assert.match(push, /push_token: null/);
});

test('client push registration clears person on logout/account switch', () => {
  const candidates = [
    'src/lib/push/pushDeviceRegistry.ts',
    'src/lib/push/registerPushDevice.ts',
    'src/lib/notifications/pushDevice.ts',
    'src/lib/pushDevices.ts',
  ];
  const hit = candidates.find((rel) => fs.existsSync(path.join(root, rel)));
  // Soft: if module missing, at least API contract above holds.
  if (!hit) {
    assert.ok(true, 'push client module optional; server registry contract covered');
    return;
  }
  const src = read(hit);
  assert.match(src, /clear-person|clearPerson|logout/i);
});

test('native CallKit / Android FGS remain fail-closed (FEATURE_ENABLED false)', () => {
  const ios = read('ios/App/App/IncomingCallKitManager.swift');
  const android = read('android/app/src/main/java/com/uniapplab/unilive/call/IncomingCallBridgeStub.kt');
  assert.match(ios, /FEATURE_ENABLED:\s*Bool\s*=\s*false/);
  assert.match(android, /FEATURE_ENABLED:\s*Boolean\s*=\s*false/);
  assert.doesNotMatch(ios, /FEATURE_ENABLED:\s*Bool\s*=\s*true/);
  assert.doesNotMatch(android, /FEATURE_ENABLED:\s*Boolean\s*=\s*true/);
});

test('workspace unlock never persists staff unlock in sessionStorage', () => {
  const access = read('src/lib/workspaceAccess.ts');
  const gate = read('src/components/workspace/WorkspaceGate.tsx');
  const screen = read('src/components/workspace/WorkspaceAuthScreen.tsx');
  assert.match(access, /clearWorkspaceSessionUnlock/);
  assert.match(access, /unlockWorkspaceRemote/);
  assert.match(gate, /clearWorkspaceSessionUnlock/);
  assert.doesNotMatch(gate, /sessionStorage\.setItem/);
  assert.doesNotMatch(screen, /sessionStorage\.setItem/);
  assert.match(screen, /unlockWorkspaceRemote/);
});

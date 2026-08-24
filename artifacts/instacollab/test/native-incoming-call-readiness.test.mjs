import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessNativeIncomingCallReadiness,
  getNativeIncomingCallFeatureFlags,
  isNativeIncomingCallRequiredForProductionStore,
  resetNativeIncomingCallFeatureFlags,
  setNativeIncomingCallFeatureFlags,
  tryPresentNativeIncomingCall,
} from '../src/lib/chat/nativeIncomingCallBridge.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('native incoming call: required for production store, defaults not ready', () => {
  resetNativeIncomingCallFeatureFlags();
  assert.equal(isNativeIncomingCallRequiredForProductionStore(), true);
  const flags = getNativeIncomingCallFeatureFlags();
  assert.equal(flags.nativeIncomingCallBridge, false);
  assert.equal(flags.iosCallKit, false);
  assert.equal(flags.androidTelecom, false);

  const web = assessNativeIncomingCallReadiness('web');
  assert.equal(web.ready, false);

  const ios = assessNativeIncomingCallReadiness('ios');
  assert.equal(ios.ready, false);
  assert.ok(ios.missing.includes('callkit'));
  assert.ok(ios.missing.includes('pushkit'));
  assert.ok(ios.blockers.some((b) => b.includes('voip') || b.includes('feature_flag')));

  const android = assessNativeIncomingCallReadiness('android');
  assert.equal(android.ready, false);
  assert.ok(android.missing.includes('telecom'));
  assert.ok(android.missing.includes('foreground_service_mic'));
});

test('native incoming call: enabling flags alone does not make ready without platform wiring', () => {
  setNativeIncomingCallFeatureFlags({
    nativeIncomingCallBridge: true,
    iosCallKit: true,
    androidTelecom: true,
  });
  const ios = assessNativeIncomingCallReadiness('ios');
  assert.equal(ios.ready, false);
  resetNativeIncomingCallFeatureFlags();
});

test('tryPresentNativeIncomingCall refuses when flags off', async () => {
  resetNativeIncomingCallFeatureFlags();
  const result = await tryPresentNativeIncomingCall({ callId: 'c1', fromUserId: 'u1' });
  assert.equal(result.accepted, false);
  assert.ok(result.reason);
});

test('native scaffolds lack CallKit/Telecom production wiring', () => {
  const plist = read('artifacts/instacollab/ios/App/App/Info.plist');
  assert.match(plist, /<string>audio<\/string>/);
  assert.doesNotMatch(plist, /<string>voip<\/string>/);

  const manifest = read('artifacts/instacollab/android/app/src/main/AndroidManifest.xml');
  assert.doesNotMatch(manifest, /ConnectionService|TelecomManager/i);
  assert.match(manifest, /CallForegroundService/);

  const delegate = read('artifacts/instacollab/ios/App/App/AppDelegate.swift');
  assert.doesNotMatch(delegate, /CXProvider|PKPushRegistry|CallKit|PushKit/);

  assert.equal(
    existsSync(
      join(
        root,
        'artifacts/instacollab/android/app/src/main/java/com/uniapplab/unilive/call/IncomingCallBridgeStub.kt',
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        root,
        'artifacts/instacollab/android/app/src/main/java/com/uniapplab/unilive/call/CallForegroundService.kt',
      ),
    ),
    true,
  );

  const notify = read('artifacts/instacollab/src/lib/chat/chatCallNotifications.ts');
  assert.match(notify, /tryPresentNativeIncomingCall/);
  assert.match(notify, /accepted:false|Ignore accepted:false/i);
});

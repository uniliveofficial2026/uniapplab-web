#!/usr/bin/env node
/**
 * Static contract: one app camera owner + facing-first rear switch + landmarks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'artifacts/instacollab/src');

function read(rel) {
  return fs.readFileSync(path.join(app, rel), 'utf8');
}

const owner = read('lib/camera/appCameraOwner.ts');
const acquire = read('lib/camera/cameraAcquire.ts');
const pipeline = read('lib/camera/useLiveTrtcPipeline.ts');
const publish = read('lib/livekit/liveKitVideoPublish.ts');
const solo = read('smule-rooms/components/SoloLiveView.tsx');
const guest = read('smule-rooms/components/GuestManagementOverlay.tsx');

assert.match(owner, /setAppCameraFacing/);
assert.match(owner, /runExclusive/);
assert.match(owner, /CAMERA_SWITCH_COMPLETE|emitCameraSwitchTrace/);
assert.match(acquire, /facingMode:\s*\{\s*ideal:\s*facingMode\s*\}|facingMode:\s*\{\s*exact:\s*facingMode\s*\}/);
assert.match(acquire, /Facing-first|facing-first|facingConstraint/);
assert.doesNotMatch(
  acquire,
  /const plans: MediaStreamConstraints\[\] = audio\s*\?\s*\[\s*\{\s*video:\s*true/,
  'must not prefer bare {video:true} before facingMode',
);
assert.match(pipeline, /setAppCameraFacing\(requested\)/);
assert.match(pipeline, /shouldMirrorCameraPreview/);
assert.match(publish, /CAMERA_RTC_REPLACE_START/);
assert.match(solo, /camera-facing-rear|camera-facing-front/);
assert.match(guest, /aria-label="camera-switch"/);

console.log('PASS camera-ownership + switch contract');
console.log(
  JSON.stringify(
    {
      owner: 'appCameraOwner',
      rearBugClassHypothesis:
        'D — openCameraMediaStream preferred {video:true} so rear switch returned front',
      fix: 'facing-first GUM + verified setAppCameraFacing + LiveKit replaceTrack trace',
    },
    null,
    2,
  ),
);

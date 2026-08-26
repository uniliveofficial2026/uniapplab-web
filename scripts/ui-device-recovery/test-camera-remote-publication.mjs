#!/usr/bin/env node
/**
 * Contract gate for remote camera publication correlation.
 * Physical Mac frames remain hardware authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = [
  'artifacts/instacollab/src/lib/camera/cameraSwitchTrace.ts',
  'artifacts/instacollab/src/lib/camera/appCameraOwner.ts',
  'artifacts/instacollab/src/lib/livekit/liveKitVideoPublish.ts',
  'artifacts/instacollab/src/lib/livekit/liveKitRemoteViewerDiag.ts',
  'artifacts/instacollab/src/lib/live/activeLiveQa.ts',
  'artifacts/instacollab/src/lib/live/viewerJoinQa.ts',
  'artifacts/instacollab/src/smule-rooms/hooks/useMultiGuestLiveKit.ts',
  'artifacts/instacollab/src/smule-rooms/components/SoloLiveView.tsx',
  'scripts/device-qa/run-camera-remote-ab.mjs',
];

const required = [
  'bumpCameraGeneration',
  'CAMERA_PIPELINE_CORRELATION',
  'CAMERA_RTC_REPLACE_START',
  'CAMERA_RTC_REPLACE_OK',
  'publishPipelineCorrelation',
  '__UNILIVE_CAMERA_PIPELINE__',
  '__UNILIVE_REMOTE_CAMERA_DEBUG__',
  '__UNILIVE_ACTIVE_LIVE_QA__',
  'VIEWER_RTC_GRANT_OK',
  'ROOM_NOT_DISCOVERED',
  'framesDecoded',
  'startRemoteCameraDiagnosticsPolling',
  'camera-source-generation-',
  'camera-rtc-published',
  'actualFacing',
  'fetchOwnerActivePartyRoom',
];

let failed = false;
for (const rel of files) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error('MISSING', rel);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  for (const token of required) {
    if (!text.includes(token) && rel.includes(path.basename(rel))) {
      // token may live in another file — checked across corpus below
    }
  }
}

const corpus = files.map((rel) => fs.readFileSync(path.join(root, rel), 'utf8')).join('\n');
for (const token of required) {
  if (!corpus.includes(token)) {
    console.error('FAIL missing token:', token);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('PASS camera-remote-publication contract');
console.log(
  JSON.stringify(
    {
      owner: 'appCameraOwner',
      correlation: 'cameraGeneration + source/render/rtc hashes',
      remoteDiag: '__UNILIVE_REMOTE_CAMERA_DEBUG__',
      note: 'Physical Mac framesDecoded delta remains required for rearCamera PASS',
    },
    null,
    2,
  ),
);

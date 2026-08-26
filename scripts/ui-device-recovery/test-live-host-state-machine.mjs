#!/usr/bin/env node
/**
 * Static contract: Solo host state machine landmarks + Go Live → Solo-Live path.
 * Physical XCUITest asserts transitions at runtime; this gate prevents landmark regressions.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'artifacts/instacollab');

function read(rel) {
  return fs.readFileSync(path.join(app, rel), 'utf8');
}

const checks = [
  {
    id: 'go-live-seeds-solo',
    file: 'src/lib/live/openLiveRoom.ts',
    must: [/Solo-Live/, /uni\.createRoom\.hint/, /openGoLiveCreateRoom/, /uni:create-room-hint/, /roomName: options\?\.roomName \|\| 'Live'/, /autoLaunch/],
  },
  {
    id: 'live-screen-go-live-entry',
    file: 'src/components/live/LiveScreen.tsx',
    must: [/aria-label="go-live-entry"/, /data-live-qa-state="go-live-entry"/],
  },
  {
    id: 'create-room-states',
    file: 'src/smule-rooms/pages/CreateRoom.tsx',
    must: [
      /data-live-qa-state=\{liveQaState\}/,
      /data-live-qa-transition=\{launchTransition\}/,
      /go-live-solo-option/,
      /live-countdown/,
      /create-room-name/,
      /retainedGoLiveHint/,
      /uni:create-room-hint/,
      /live-go-live-launch/,
      /live-launch-blocked-/,
      /COUNTDOWN_START/,
      /CREATE_ROOM_CLICKED/,
      /goToHostLiveRoom/,
      /instant-room-open/,
      /native-dom/,
      /type="button"/,
      /snapRef/,
      /pendingAutoLaunchRef/,
      /launchBtnRef/,
    ],
  },
  {
    id: 'solo-live-view-states',
    file: 'src/smule-rooms/components/SoloLiveView.tsx',
    must: [
      /solo-live-view/,
      /live-permission-camera-pending/,
      /live-rtc-connecting/,
      /live-rtc-connected/,
      /live-error-state/,
      /live-chat-input/,
      /subscribeHostMedia/,
      /SOLO_VIEW_MOUNTED/,
    ],
  },
  {
    id: 'solo-controls-chat-toggle',
    file: 'src/smule-rooms/components/SoloShopLiveControls.tsx',
    must: [/Show chat/, /Hide chat/, /Solo Live controls/],
  },
  {
    id: 'chat-visibility-condition',
    file: 'src/smule-rooms/components/SoloLiveView.tsx',
    must: [/chatComposerOpen/, /useState\(true\)/],
  },
];

for (const c of checks) {
  const src = read(c.file);
  for (const re of c.must) {
    assert.match(src, re, `${c.id} missing ${re}`);
  }
  console.log(`PASS ${c.id}`);
}

console.log('\nlive-host-state-machine static gates PASS');
console.log(
  JSON.stringify(
    {
      rootCauseHypothesis:
        'CreateRoom defaulted to Chat; Go Live without Solo never mounted SoloLiveView/live-chat-input',
      fix: 'openGoLiveCreateRoom seeds Solo-Live hint; landmarks expose each host state',
    },
    null,
    2,
  ),
);

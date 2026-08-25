#!/usr/bin/env node
/**
 * test:all-screen-layout — static + source SSOT gates for UniLive UI recovery.
 * Does not claim physical PASS. Fails if keyboard/viewport SSOT regresses.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const app = path.join(root, 'artifacts/instacollab');

function read(rel) {
  return fs.readFileSync(path.join(app, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(app, rel));
}

const VIEWPORTS = [
  [320, 568],
  [375, 667],
  [390, 844],
  [393, 852],
  [430, 932],
  [768, 1024],
  [1280, 800],
];

// --- SSOT files present ---
assert.ok(exists('src/lib/safeArea.ts'), 'safeArea SSOT missing');
assert.ok(exists('src/contexts/AppViewportContext.tsx'), 'AppViewportProvider missing');

const safeArea = read('src/lib/safeArea.ts');
assert.match(safeArea, /setNativeKeyboardHeight/);
assert.match(safeArea, /--app-composer-bottom-inset/);
assert.match(safeArea, /--app-keyboard-inset/);
assert.match(safeArea, /--app-vv-height/);
assert.match(safeArea, /subscribeAppViewport/);
// Must NOT fold keyboard into static safe-bottom assignment from vv.bottom alone
assert.ok(
  !/const bottom = Math\.max\(env\.bottom, vv\.bottom/.test(safeArea),
  'safe-bottom must not include visualViewport keyboard inset',
);

const boot = read('src/lib/bootNativeShell.ts');
assert.match(boot, /KeyboardResize\.None/);
assert.match(boot, /setNativeKeyboardHeight/);
assert.ok(!/KeyboardResize\.Body/.test(boot), 'Body resize must not be active (double-move)');

const css = read('src/index.css');
assert.match(css, /--app-composer-bottom-inset/);
assert.match(css, /html\[data-keyboard-open='1'\] \.mobile-bottom-nav/);
assert.match(css, /\.h-vv/);

const compose = read('src/components/messages/MessagesComposeBar.tsx');
assert.match(compose, /data-testid="chat-input"/);
assert.match(compose, /data-testid="chat-send"/);
assert.match(compose, /--app-composer-bottom-inset/);
assert.match(compose, /text-\[16px\]/);

const liveCss = read('src/smule-rooms/components/solo-shop-live-approved.css');
assert.match(liveCss, /--app-composer-bottom-inset/);

const liveView = read('src/smule-rooms/components/SoloLiveView.tsx');
assert.match(liveView, /data-testid="live-chat-input"/);

const shell = read('src/components/layout/Shell.tsx');
assert.match(shell, /data-testid="home-nav"/);
assert.match(shell, /h-vv/);

const main = read('src/main.tsx');
assert.match(main, /AppViewportProvider/);

const appDelegate = read('ios/App/App/AppDelegate.swift');
assert.match(appDelegate, /isInspectable/);
assert.match(appDelegate, /#if DEBUG/);

// Screen inventory from shell tabs + known route table
const routes = read('src/lib/appShellRoutes.ts');
assert.match(routes, /TAB_PATH/);
for (const tab of ['home', 'messages', 'live', 'wallet', 'youtube', 'dating']) {
  assert.match(routes, new RegExp(`${tab}:`));
}

// Viewport matrix recorded for gate metadata (physical still separate)
const matrixPath = path.join(root, 'docs/ui-device-recovery/13-DEVICE-MATRIX.md');
assert.ok(fs.existsSync(matrixPath), 'device matrix doc missing');

console.log(
  JSON.stringify(
    {
      ok: true,
      viewports: VIEWPORTS,
      note: 'Static SSOT gate only — physical iPhone remains acceptance authority',
    },
    null,
    2,
  ),
);

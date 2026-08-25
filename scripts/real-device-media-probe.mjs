#!/usr/bin/env node
/**
 * Real-hardware media probe against production (NOT fake camera).
 * Uses Mac FaceTime HD + microphone via Chromium getUserMedia.
 * Captures track metadata + a JPEG frame into docs/real-device-qa/evidence/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(path.join(root, 'artifacts/instacollab/package.json'));
const { chromium } = require('playwright');
const evidenceDir = path.join(root, 'docs/real-device-qa/evidence');
const origin = (process.env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');

fs.mkdirSync(evidenceDir, { recursive: true });

const result = {
  ok: false,
  origin,
  at: new Date().toISOString(),
  fakeMedia: false,
  video: null,
  audio: null,
  framePath: null,
  error: null,
};

const browser = await chromium.launch({
  headless: false,
  args: [
    '--use-fake-ui-for-media-stream', // auto-grant permission UI only; still real devices
    // deliberately NOT --use-fake-device-for-media-stream
  ],
});

const context = await browser.newContext({
  permissions: ['camera', 'microphone'],
});
const page = await context.newPage();

try {
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  const media = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    const v = stream.getVideoTracks()[0];
    const a = stream.getAudioTracks()[0];
    const vs = v?.getSettings?.() || {};
    const as_ = a?.getSettings?.() || {};

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 400));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const labelHint = String(v?.label || '');
    const looksFake =
      /fake|mock|synthetic/i.test(labelHint) ||
      (vs.deviceId === 'fake' || as_.deviceId === 'fake');

    stream.getTracks().forEach((t) => t.stop());
    return {
      looksFake,
      video: {
        label: v?.label || null,
        readyState: v?.readyState || null,
        muted: v?.muted ?? null,
        enabled: v?.enabled ?? null,
        settings: vs,
      },
      audio: {
        label: a?.label || null,
        readyState: a?.readyState || null,
        muted: a?.muted ?? null,
        enabled: a?.enabled ?? null,
        settings: as_,
      },
      dataUrl,
      dimensions: { w: canvas.width, h: canvas.height },
    };
  });

  if (media.looksFake) {
    throw new Error('Probe appears to use fake media device — aborting (not real hardware)');
  }

  const framePath = path.join(evidenceDir, 'production-origin-real-gum-frame.jpg');
  const b64 = media.dataUrl.replace(/^data:image\/jpeg;base64,/, '');
  fs.writeFileSync(framePath, Buffer.from(b64, 'base64'));

  result.ok = true;
  result.video = media.video;
  result.audio = media.audio;
  result.framePath = framePath;
  result.dimensions = media.dimensions;
} catch (err) {
  result.error = err instanceof Error ? err.message : String(err);
} finally {
  await browser.close();
}

const outPath = path.join(evidenceDir, 'real-media-probe.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

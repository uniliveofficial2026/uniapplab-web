#!/usr/bin/env node
/**
 * Physical A/B camera remote publication harness.
 *
 * Host A = Cap iPhone (XCUITest / already live)
 * Viewer B = Playwright Chromium on Mac using .local/qa-mac-creds.json
 *
 * Usage:
 *   UNILIVE_CAMERA_ROOM_ID=<roomId> node scripts/device-qa/run-camera-remote-ab.mjs
 *
 * Optional:
 *   UNILIVE_CAMERA_ROOM_FILE=.local/camera-ab-room.json  (polls for { roomId })
 *   UNILIVE_CAMERA_AB_SECONDS=90
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, '.local/device-logs');
fs.mkdirSync(OUT, { recursive: true });

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${url} non-JSON ${res.status}`);
  }
  if (!res.ok) throw new Error(`${url} ${res.status}: ${text.slice(0, 160)}`);
  return json;
}

async function waitForRoomId() {
  if (process.env.UNILIVE_CAMERA_ROOM_ID?.trim()) {
    return process.env.UNILIVE_CAMERA_ROOM_ID.trim();
  }
  const file =
    process.env.UNILIVE_CAMERA_ROOM_FILE || path.join(root, '.local/camera-ab-room.json');
  const deadline = Date.now() + Number(process.env.UNILIVE_CAMERA_ROOM_WAIT_MS || 180_000);
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) {
      try {
        const j = loadJson(file);
        if (j.roomId) return String(j.roomId);
      } catch {
        /* retry */
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('ROOM_ID missing — set UNILIVE_CAMERA_ROOM_ID or write .local/camera-ab-room.json');
}

async function main() {
  const macCreds = loadJson(path.join(root, '.local/qa-mac-creds.json'));
  const boot = await fetchJson('https://app.uniapplab.com/api/app-config/bootstrap');
  const { supabaseUrl, supabaseAnonKey } = boot.public;
  const token = await fetchJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: macCreds.email, password: macCreds.password }),
  });

  const roomId = await waitForRoomId();
  const seconds = Number(process.env.UNILIVE_CAMERA_AB_SECONDS || 120);
  const outFile = path.join(OUT, `camera-remote-ab-${Date.now()}.json`);

  const browser = await chromium.launch({ headless: process.env.UNILIVE_CAMERA_AB_HEADED !== '1' });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: [],
  });
  const page = await context.newPage();

  // Seed Supabase session into localStorage before app boot.
  await page.addInitScript(
    ({ url, anon, access, refresh }) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
      const payload = {
        access_token: access,
        refresh_token: refresh,
        expires_in: 3600,
        token_type: 'bearer',
        user: null,
      };
      // Common Vite/supabase-js storage key pattern; also set a few fallbacks.
      const candidates = [
        key,
        `sb-${new URL(url).hostname.split('.')[0]}-auth-token`,
        'supabase.auth.token',
      ].filter(Boolean);
      for (const k of candidates) {
        try {
          localStorage.setItem(k, JSON.stringify(payload));
        } catch {
          /* ignore */
        }
      }
      void anon;
    },
    {
      url: supabaseUrl,
      anon: supabaseAnonKey,
      access: token.access_token,
      refresh: token.refresh_token,
    },
  );

  const roomUrl = `https://app.uniapplab.com/?openRoom=${encodeURIComponent(roomId)}#/room/${encodeURIComponent(roomId)}`;
  await page.goto(roomUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(8000);

  // Try InstantRoom open event if SPA is already loaded on home shell.
  await page.evaluate((id) => {
    window.dispatchEvent(
      new CustomEvent('instant-room-open', {
        detail: { path: `/room/${id}`, roomId: id },
      }),
    );
  }, roomId);
  await page.waitForTimeout(5000);

  const samples = [];
  const started = Date.now();
  while (Date.now() - started < seconds * 1000) {
    const snap = await page.evaluate(() => {
      const w = window;
      return {
        at: Date.now(),
        remote: w.__UNILIVE_REMOTE_CAMERA_DEBUG__ || null,
        historyLen: Array.isArray(w.__UNILIVE_REMOTE_CAMERA_HISTORY__)
          ? w.__UNILIVE_REMOTE_CAMERA_HISTORY__.length
          : 0,
        href: location.href,
        title: document.title,
      };
    });
    samples.push(snap);
    await page.waitForTimeout(2000);
  }

  const remoteSamples = samples.map((s) => s.remote).filter(Boolean);
  const withFrames = remoteSamples.filter((s) => typeof s.framesDecoded === 'number');
  let framesDelta = 0;
  let bytesDelta = 0;
  if (withFrames.length >= 2) {
    framesDelta =
      (withFrames[withFrames.length - 1].framesDecoded || 0) - (withFrames[0].framesDecoded || 0);
    bytesDelta =
      (withFrames[withFrames.length - 1].bytesReceived || 0) - (withFrames[0].bytesReceived || 0);
  }

  const audioSamples = remoteSamples.filter((s) => typeof s.audioBytesReceived === 'number');
  let audioBytesDelta = 0;
  if (audioSamples.length >= 2) {
    audioBytesDelta =
      (audioSamples[audioSamples.length - 1].audioBytesReceived || 0) -
      (audioSamples[0].audioBytesReceived || 0);
  }

  const result = {
    roomId,
    viewerCanonicalPersonIdHash: token.user?.id
      ? `h${[...String(token.user.id)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0}`
      : null,
    samples: samples.length,
    remoteSamples: remoteSamples.length,
    framesDecodedDelta: framesDelta,
    bytesReceivedDelta: bytesDelta,
    audioBytesReceivedDelta: audioBytesDelta,
    lastRemote: remoteSamples[remoteSamples.length - 1] || null,
    macRemoteVideoProgressing: framesDelta > 0 || bytesDelta > 0,
    macRemoteAudioProgressing: audioBytesDelta > 0,
    verdict: framesDelta > 0 || bytesDelta > 0 ? 'REMOTE_FRAMES_PROGRESSING' : 'REMOTE_FRAMES_STALE_OR_MISSING',
  };

  fs.writeFileSync(outFile, JSON.stringify({ result, samples }, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.log('WROTE', outFile);

  await browser.close();
  if (!result.macRemoteVideoProgressing) process.exitCode = 2;
}

main().catch((err) => {
  console.error('FAIL', err?.message || err);
  process.exit(1);
});

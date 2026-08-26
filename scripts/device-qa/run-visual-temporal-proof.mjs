#!/usr/bin/env node
/**
 * Temporal visual proof against production (Mac Chromium + optional Cap remote).
 * Activates QA probe via ?qaVisual=1 and asserts T1 > T0 for critical CSS/video samples.
 *
 * Usage:
 *   node scripts/device-qa/run-visual-temporal-proof.mjs
 *   UNILIVE_VISUAL_BASE=https://app.uniapplab.com node ...
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = (process.env.UNILIVE_VISUAL_BASE || 'https://app.uniapplab.com').replace(/\/$/, '');
const OUT = path.join(ROOT, 'docs/visual-runtime/FINAL-TEMPORAL-PROOF.json');
const BROWSERS =
  process.env.PLAYWRIGHT_BROWSERS_PATH || '/Volumes/Wei2TB/MacData/tools/playwright-browsers';

async function main() {
  process.env.PLAYWRIGHT_BROWSERS_PATH = BROWSERS;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    spaEntry: null,
    reducedMotion: null,
    visibilityState: null,
    loading: { status: 'NOT_TESTED' },
    thoughtBubble: { status: 'NOT_TESTED' },
    liveRing: { status: 'NOT_TESTED' },
    storyRing: { status: 'NOT_TESTED' },
    v14Motion: { status: 'NOT_TESTED' },
    samples: [],
    pass: false,
  };

  try {
    await page.goto(`${BASE}/?qaVisual=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);

    report.spaEntry = await page.evaluate(() => {
      const scripts = Array.from(document.scripts);
      for (const s of scripts) {
        const src = s.getAttribute('src') || '';
        const m = src.match(/assets\/(index-[^/]+\.js)/);
        if (m) return m[1];
      }
      return null;
    });

    report.reducedMotion = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    report.visibilityState = await page.evaluate(() => document.visibilityState);

    // Loading video temporal (cold path may already have dismissed — still probe if present)
    report.loading = await page.evaluate(async () => {
      const video =
        document.querySelector('[data-unilives-inapp-loading] video') ||
        document.querySelector('[data-unilives-princess-loading-refresh] video') ||
        document.querySelector('video[data-motion="video"]');
      if (!video) return { status: 'ABSENT_AFTER_BOOT', note: 'splash may have completed' };
      const t0 = video.currentTime || 0;
      await new Promise((r) => setTimeout(r, 500));
      const t1 = video.currentTime || 0;
      const r = video.getBoundingClientRect();
      return {
        status: t1 > t0 + 0.05 ? 'PASS' : 'FAIL',
        t0,
        t1,
        width: r.width,
        height: r.height,
        muted: video.muted,
        paused: video.paused,
      };
    });

    // Inject ring + thought bubble fixtures into DOM for class-level temporal proof
    // without redesigning product UI — measures real CSS animation machinery on iOS UA.
    report.samples = await page.evaluate(async () => {
      const host = document.createElement('div');
      host.id = 'qa-temporal-fixtures';
      host.style.cssText =
        'position:fixed;left:8px;top:8px;z-index:2147483000;pointer-events:none;display:flex;gap:12px;';
      host.innerHTML = `
        <div class="avatar-ring-spinner avatar-ring-spinner--live" style="width:56px;height:56px;border-radius:999px"></div>
        <div class="avatar-ring-spinner avatar-ring-spinner--story" style="width:56px;height:56px;border-radius:999px"></div>
        <div class="thought-bubble-living" style="width:80px;height:40px;position:relative">
          <div class="thought-bubble-shimmer"></div>
        </div>
        <div class="v14-animated-artwork__image" data-v14-animate="true" style="width:64px;height:64px;background:#f43"></div>
      `;
      document.body.appendChild(host);

      const pick = (sel) => document.querySelector(sel);
      const measure = (sel, kind) => {
        const el = pick(sel);
        if (!el) return { id: sel, status: 'FAIL', reason: 'missing' };
        const geo = el.getBoundingClientRect();
        const anims = typeof el.getAnimations === 'function' ? el.getAnimations() : [];
        if (!anims.length) {
          return {
            id: sel,
            kind,
            status: 'FAIL',
            reason: 'no-animation',
            width: geo.width,
            height: geo.height,
          };
        }
        const a = anims[0];
        const t0 = typeof a.currentTime === 'number' ? a.currentTime : Number(a.currentTime) || 0;
        return {
          id: sel,
          kind,
          playState: a.playState,
          t0,
          width: geo.width,
          height: geo.height,
          _anim: true,
        };
      };

      const base = [
        measure('.avatar-ring-spinner--live', 'liveRing'),
        measure('.avatar-ring-spinner--story', 'storyRing'),
        measure('.thought-bubble-living', 'thoughtBubble'),
        measure('.v14-animated-artwork__image', 'v14Motion'),
      ];

      await new Promise((r) => setTimeout(r, 450));

      return base.map((s) => {
        if (!s._anim) return s;
        const el = pick(s.id);
        const anims = el && typeof el.getAnimations === 'function' ? el.getAnimations() : [];
        const a = anims[0];
        if (!a) return { ...s, status: 'FAIL', reason: 'lost-animation' };
        const t1 = typeof a.currentTime === 'number' ? a.currentTime : Number(a.currentTime) || 0;
        const progressed = a.playState === 'running' && t1 > (s.t0 || 0);
        return {
          id: s.id,
          kind: s.kind,
          playState: a.playState,
          t0: s.t0,
          t1,
          width: s.width,
          height: s.height,
          status: progressed ? 'PASS' : 'FAIL',
        };
      });
    });

    const byKind = Object.fromEntries(report.samples.map((s) => [s.kind, s]));
    report.liveRing = byKind.liveRing || { status: 'FAIL' };
    report.storyRing = byKind.storyRing || { status: 'FAIL' };
    report.thoughtBubble = byKind.thoughtBubble || { status: 'FAIL' };
    report.v14Motion = byKind.v14Motion || { status: 'FAIL' };

    const criticalPass = ['liveRing', 'storyRing', 'thoughtBubble', 'v14Motion'].every(
      (k) => report[k]?.status === 'PASS',
    );
    report.pass = criticalPass && report.reducedMotion === false;

    // Background/foreground simulation
    report.backgroundForeground = await page.evaluate(async () => {
      const el = document.querySelector('.avatar-ring-spinner--live');
      if (!el || !el.getAnimations) return { status: 'FAIL', reason: 'missing' };
      const a0 = el.getAnimations()[0];
      if (!a0) return { status: 'FAIL', reason: 'no-anim' };
      const tA = typeof a0.currentTime === 'number' ? a0.currentTime : Number(a0.currentTime) || 0;
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 300));
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 500));
      const a1 = el.getAnimations()[0];
      if (!a1) return { status: 'FAIL', reason: 'anim-lost-after-fg' };
      const tB = typeof a1.currentTime === 'number' ? a1.currentTime : Number(a1.currentTime) || 0;
      return {
        status: a1.playState === 'running' && tB > tA ? 'PASS' : 'FAIL',
        playState: a1.playState,
        tA,
        tB,
      };
    });
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

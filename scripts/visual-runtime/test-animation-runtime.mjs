#!/usr/bin/env node
/**
 * Animation runtime structural gate.
 * Verifies critical CSS keyframes + V14 motion CSS + loading video path exist.
 * Temporal progression remains physical-iPhone / Playwright-optional.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const checks = [
  {
    file: 'artifacts/instacollab/src/index.css',
    needles: ['@keyframes avatar-ring-spin', '@keyframes thought-bubble-float'],
  },
  {
    file: 'artifacts/instacollab/src/smule-rooms/components/live-artwork-motion.css',
    needles: ['v14-gift-bill-flutter', 'v14-sticker-hi-wave', "data-v14-animate='false'"],
  },
  {
    file: 'artifacts/instacollab/src/components/brand/UniLivesPrincessLoadingRefreshLayout.tsx',
    needles: ['playsInline', 'muted', 'autoPlay', 'installVideoLoopGuard'],
  },
  {
    file: 'artifacts/instacollab/src/lib/unilives-assets/featureFlags.ts',
    needles: ['muteAnimations: false'],
  },
];

const fails = [];
for (const c of checks) {
  const abs = path.join(ROOT, c.file);
  if (!fs.existsSync(abs)) {
    fails.push({ file: c.file, err: 'missing' });
    continue;
  }
  const text = fs.readFileSync(abs, 'utf8');
  for (const n of c.needles) {
    if (!text.includes(n)) fails.push({ file: c.file, missingNeedle: n });
  }
}

// Reduced motion must not globally kill all animations
const indexCss = fs.readFileSync(path.join(ROOT, 'artifacts/instacollab/src/index.css'), 'utf8');
if (/\*\s*\{\s*animation:\s*none\s*!important/.test(indexCss)) {
  fails.push({ err: 'GLOBAL_REDUCED_MOTION_KILL' });
}

if (fails.length) {
  console.error(JSON.stringify({ ok: false, fails }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks: checks.length }, null, 2));

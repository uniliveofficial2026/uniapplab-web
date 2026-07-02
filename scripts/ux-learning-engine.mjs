#!/usr/bin/env node
/**
 * Pattern learning from UX signals — infers friction, hotspots, and user intent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIGNALS = path.join(ROOT, '.local/ux-signals.jsonl');
const OUT = path.join(ROOT, '.local/ux-learning.json');

function loadSignals() {
  if (!fs.existsSync(SIGNALS)) return [];
  return fs
    .readFileSync(SIGNALS, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function topCounts(items, key, limit = 8) {
  const map = new Map();
  for (const item of items) {
    const v = item[key];
    if (!v) continue;
    map.set(v, (map.get(v) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function analyze(signals) {
  const errors = signals.filter((s) => s.type === 'error');
  const media = signals.filter((s) => s.type === 'media_fail' || s.detail?.includes('media'));
  const rage = signals.filter((s) => s.type === 'rage_tap');
  const screens = signals.filter((s) => s.type === 'screen_view');
  const dwell = signals.filter((s) => s.type === 'dwell');

  const screenTime = new Map();
  for (const d of dwell) {
    const ms = Number(d.meta?.ms ?? 0);
    if (!ms) continue;
    screenTime.set(d.detail || d.screen, (screenTime.get(d.detail || d.screen) || 0) + ms);
  }

  const intents = [];
  const topScreen = topCounts(screens, 'detail', 1)[0];
  const topRage = topCounts(rage, 'detail', 1)[0];
  const topErrorScreen = topCounts(errors, 'screen', 1)[0];

  if (topScreen) {
    intents.push({
      kind: 'engagement',
      message: `Users spend most time on "${topScreen.name}" — prioritize polish and fast loads there.`,
      priority: 'high',
    });
  }
  if (topRage) {
    intents.push({
      kind: 'friction',
      message: `Repeated taps on "${topRage.name}" (${topRage.count}x) — likely broken tap target or slow response.`,
      priority: 'critical',
    });
  }
  if (topErrorScreen) {
    intents.push({
      kind: 'stability',
      message: `Most errors occur on screen "${topErrorScreen.name}" — auto-heal should target this screen.`,
      priority: 'critical',
    });
  }
  if (media.length >= 3) {
    intents.push({
      kind: 'media',
      message: `${media.length} media failures — improve hydration, fallbacks, and cloud upload.`,
      priority: 'high',
    });
  }

  const frictionScore = Math.min(
    100,
    errors.length * 3 + rage.length * 5 + media.length * 4,
  );

  return {
    analyzedAt: new Date().toISOString(),
    totalSignals: signals.length,
    frictionScore,
    topScreens: topCounts(screens, 'detail'),
    errorHotspots: topCounts(errors, 'screen'),
    rageTargets: topCounts(rage, 'detail'),
    mediaFailures: media.length,
    screenDwellMs: [...screenTime.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([screen, ms]) => ({ screen, ms })),
    intents,
  };
}

const signals = loadSignals();
const report = analyze(signals);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

if (process.env.UX_AGENT_SILENT !== '1') {
  console.log(`[ux-learn] ${signals.length} signals · friction ${report.frictionScore}`);
  for (const intent of report.intents.slice(0, 5)) {
    console.log(`  → [${intent.priority}] ${intent.message}`);
  }
}

export { analyze };

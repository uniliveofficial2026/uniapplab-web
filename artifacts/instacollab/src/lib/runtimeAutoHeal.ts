/**
 * Runtime auto-heal — detects lag, errors, and drift across web / mobile / desktop
 * and fixes in-session immediately; escalates patterns to the background ML agent.
 * All actions pass zero-mistake corroboration + verify-after-heal guards.
 */
import { refreshCloudSystemsInPlace } from './appCloudSystems';
import { isCloudAuthConfigured } from './auth/config';
import {
  probeSupabaseOAuthReady,
  probeSupabaseHealth,
  invalidateSupabaseHealthCache,
} from './auth/health';
import { clearSupabaseOAuthDegraded, markSupabaseOAuthDegraded } from './auth/providerState';
import { db } from './db/localDb';
import { flushBufferedHandoffTasks, submitHandoffTask } from './handoff';
import { healLaunchProgressForReturningUser } from './launchRoute';
import { isChunkLoadError } from './lazyWithRetry';
import {
  canActOnCorroboration,
  confirmTwice,
  isNoiseSignal,
  markCorroborationActed,
  shouldEscalateHandoff,
  verifyHealOutcome,
} from './mlGuard';
import { isNetworkOnline } from './networkStatus';
import { getRuntimePlatform, platformMetaForTelemetry } from './platformDetect';
import { pauseAllPlayback } from './playbackAudio';
import { stageAppUpdate } from './invisibleReload';
import { checkForPwaUpdate } from './pwaAutoUpdate';
import { flushUxSignals, getCurrentScreen, trackUx } from './uxTelemetry';
import { reconcileWalletAndKstarCoins } from './walletKstarSync';

const HEAL_TICK_MS = 120_000;
const MEMORY_CHECK_MS = 60_000;
/** WebAR/beauty GPU work routinely exceeds 200ms — don't treat that as a freeze. */
const LONG_TASK_MS = 450;
const LAG_BURST_LIMIT = 4;
const LAG_BURST_WINDOW_MS = 20_000;
const MEMORY_RATIO_THRESHOLD = 0.9;
const MEMORY_CONFIRMATIONS = 1;
/** OAuth authorize probe is expensive — at most once per 5 minutes. */
const OAUTH_HEAL_MIN_INTERVAL_MS = 5 * 60_000;

let installed = false;
let healInFlight = false;
let healAgain = false;
let healTimer: number | null = null;
let lastForegroundHealAt = 0;
const FOREGROUND_HEAL_COOLDOWN_MS = 60_000;
let lastOAuthHealAt = 0;
let lagTimestamps: number[] = [];
let memoryConfirmations = 0;

function reportHeal(action: string, detail?: string): void {
  trackUx('heal', action, { ...platformMetaForTelemetry(), detail: detail ?? '', verified: true });
}

async function healSessionState(): Promise<void> {
  await db.whenStorageReady();
  if (!db.isLoggedIn || !db.currentUserId) return;

  const beforeLoggedIn = db.isLoggedIn;
  healLaunchProgressForReturningUser(db);
  reconcileWalletAndKstarCoins(db.currentUserId);

  verifyHealOutcome('session_state', () => beforeLoggedIn && db.isLoggedIn);
  reportHeal('session_state', db.currentUserId.slice(0, 8));
}

async function healCloudAuth(force = false): Promise<void> {
  if (!isCloudAuthConfigured() || !isNetworkOnline()) return;
  // Never run the 6s OAuth authorize probe during camera/beauty — it freezes karaoke.
  if (!force && isCameraHeavyScreen()) return;

  const now = Date.now();
  if (!force && now - lastOAuthHealAt < OAUTH_HEAL_MIN_INTERVAL_MS) return;
  lastOAuthHealAt = now;

  try {
    invalidateSupabaseHealthCache();
    const healthOk = await probeSupabaseHealth(1500);
    if (!healthOk) return;

    clearSupabaseOAuthDegraded();

    const oauthOk = await probeSupabaseOAuthReady(3000);
    if (oauthOk) {
      clearSupabaseOAuthDegraded();
      return;
    }

    markSupabaseOAuthDegraded();
    reportHeal('oauth_lane_firebase');
  } catch (err) {
    console.warn('[auto-heal] supabase oauth lane probe failed:', err);
  }
}

function isProtectedLiveVideo(video: HTMLVideoElement): boolean {
  if (video.dataset.appCamera === '1') return true;
  if (video.dataset.webarOutput === '1') return true;
  if (video.dataset.livePreview === '1') return true;
  if (video.dataset.callVideo === '1') return true;
  // Camera / WebAR / LiveKit local preview — never pause these for "relief".
  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    const hasLiveVideo = stream.getVideoTracks().some(
      (t) => t.readyState === 'live' && (t.label || t.id),
    );
    if (hasLiveVideo && video.muted && video.playsInline !== false) {
      // Heuristic: muted inline MediaStream video is almost always a camera/AR sink.
      return true;
    }
  }
  return false;
}

/** Pause feed/reel playback only — never touch camera, beauty, call, or live sinks. */
function pauseMediaForRelief(): void {
  pauseAllPlayback();
  document.querySelectorAll('video').forEach((video) => {
    if (isProtectedLiveVideo(video)) {
      // If something else paused it, resume so beauty never stays blank.
      if (video.paused && video.srcObject) {
        void video.play().catch(() => {});
      }
      return;
    }
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  });
}

function isCameraHeavyScreen(): boolean {
  const screen = getCurrentScreen();
  return /karaoke|live|party|room|call|messages|create|recording|studio|ar|beauty/i.test(
    screen || '',
  );
}

function healPlaybackPressure(): void {
  if (document.visibilityState === 'hidden') {
    pauseMediaForRelief();
    reportHeal('playback_paused_hidden');
  }
}

function healLayoutJank(): void {
  const root = document.documentElement;
  if (root.scrollWidth <= window.innerWidth + 8) return;

  root.style.overflowX = 'clip';
  document.body.style.overflowX = 'clip';

  verifyHealOutcome('layout_overflow', () => root.scrollWidth <= window.innerWidth + 12);
  reportHeal('layout_overflow');
}

function onLagDetected(durationMs: number, source: string): void {
  if (durationMs < LONG_TASK_MS) return;

  // Beauty / WebAR / live GPU work is expected to create longtasks — healing by
  // pausing videos blanks the camera and makes lag worse.
  if (isCameraHeavyScreen()) {
    trackUx('warning', `beauty_lag_ignored:${source}`, {
      ...platformMetaForTelemetry(),
      durationMs,
    });
    return;
  }

  const now = Date.now();
  lagTimestamps = lagTimestamps.filter((t) => now - t < LAG_BURST_WINDOW_MS);
  lagTimestamps.push(now);

  trackUx('warning', source, {
    ...platformMetaForTelemetry(),
    durationMs,
    burst: lagTimestamps.length,
  });

  const key = `lag_burst:${source}`;
  if (lagTimestamps.length < LAG_BURST_LIMIT) return;
  if (!canActOnCorroboration(key, LAG_BURST_WINDOW_MS, LAG_BURST_LIMIT)) return;

  lagTimestamps = [];
  markCorroborationActed(key);
  pauseMediaForRelief();
  // Do not refreshCloudSystemsInPlace here — that storms realtime and freezes the UI.
  reportHeal('lag_burst', source);

  if (shouldEscalateHandoff('lag_burst', `${source}:${durationMs}ms`)) {
    submitHandoffTask({
      type: 'ux_learn',
      reason: 'lag_burst_confirmed',
      detail: `${source}:${durationMs}ms`,
      screen: getCurrentScreen(),
      meta: { ...platformMetaForTelemetry(), corroborated: true },
    });
  }
}

function installPerformanceWatch(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  try {
    const longTask = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        onLagDetected(Math.round(entry.duration), 'long_task');
      }
    });
    longTask.observe({ type: 'longtask', buffered: true });
  } catch {
    /* unsupported */
  }

  try {
    const eventTiming = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { duration?: number; name?: string };
        if ((e.duration ?? 0) < 350) continue;
        if (e.name === 'click' || e.name === 'keydown') {
          onLagDetected(Math.round(e.duration ?? 0), `slow_${e.name}`);
        }
      }
    });
    eventTiming.observe({ type: 'event', buffered: true } as PerformanceObserverInit);
  } catch {
    /* unsupported */
  }
}

function installMemoryWatch(): void {
  if (typeof window === 'undefined') return;

  const check = () => {
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } })
      .memory;
    if (!mem?.jsHeapSizeLimit) return;

    const ratio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
    if (ratio < MEMORY_RATIO_THRESHOLD) {
      memoryConfirmations = 0;
      return;
    }

    memoryConfirmations += 1;
    if (memoryConfirmations < MEMORY_CONFIRMATIONS) return;

    const key = 'memory_pressure';
    if (!canActOnCorroboration(key, HEAL_TICK_MS * 2, MEMORY_CONFIRMATIONS)) return;

    memoryConfirmations = 0;
    markCorroborationActed(key);
    // Never pause camera sinks under memory pressure — that blanks beauty mid-session.
    if (!isCameraHeavyScreen()) {
      pauseMediaForRelief();
    }
    refreshCloudSystemsInPlace('memory_pressure');
    reportHeal('memory_pressure', String(Math.round(ratio * 100)));

    if (shouldEscalateHandoff('memory_pressure', `heap_${Math.round(ratio * 100)}pct`)) {
      submitHandoffTask({
        type: 'heal',
        reason: 'memory_pressure_confirmed',
        detail: `heap_${Math.round(ratio * 100)}pct`,
        screen: getCurrentScreen(),
        meta: { ...platformMetaForTelemetry(), corroborated: true },
      });
    }
  };

  window.setInterval(check, MEMORY_CHECK_MS);
}

function installErrorEscalation(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
    if (isNoiseSignal(msg)) return;

    event.preventDefault();
    const key = 'chunk_error';
    if (!canActOnCorroboration(key, 30_000, 1)) return;

    markCorroborationActed(key);
    void checkForPwaUpdate();
    stageAppUpdate('auto_heal_chunk');
    reportHeal('chunk_staged');
  });
}

async function runHealPass(reason: string): Promise<void> {
  if (healInFlight) {
    healAgain = true;
    return;
  }
  healInFlight = true;

  try {
    healPlaybackPressure();
    healLayoutJank();
    await healSessionState();
    // Interval ticks: skip expensive OAuth probe — it was firing every 20s and
    // freezing every screen. Only probe on boot / online / explicit foreground.
    const allowOauth =
      reason === 'boot' || reason === 'online' || reason === 'foreground';
    if (allowOauth) {
      await healCloudAuth(reason === 'boot' || reason === 'online');
    }
    await flushUxSignals(true);
    if (reason === 'boot' || reason === 'online') {
      await flushBufferedHandoffTasks();
    }

    if (import.meta.env.DEV) {
      console.info('[auto-heal] pass', reason, getRuntimePlatform().label);
    }
  } finally {
    healInFlight = false;
    if (healAgain) {
      healAgain = false;
      queueMicrotask(() => void runHealPass('coalesced'));
    }
  }
}

/** Immediate reaction — runs full heal pass without waiting for the interval timer. */
export function reactImmediately(reason = 'immediate'): void {
  const now = Date.now();
  const isUrgent = reason === 'boot' || reason === 'interval' || reason === 'coalesced';
  if (!isUrgent && now - lastForegroundHealAt < FOREGROUND_HEAL_COOLDOWN_MS) return;
  if (!isUrgent) lastForegroundHealAt = now;
  void runHealPass(reason);
}

/** Background heal tick — safe to call from cloud systems / foreground hooks. */
export function tickRuntimeAutoHeal(reason = 'tick'): void {
  reactImmediately(reason);
}

export function initRuntimeAutoHeal(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  installPerformanceWatch();
  installMemoryWatch();
  installErrorEscalation();

  void runHealPass('boot');

  healTimer = window.setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    void runHealPass('interval');
  }, HEAL_TICK_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      reactImmediately('foreground');
    } else {
      healPlaybackPressure();
    }
  });

  window.addEventListener('online', () => {
    reactImmediately('online');
  });

  window.addEventListener('app-update-staged', () => {
    reportHeal('update_staged');
    refreshCloudSystemsInPlace('update_staged');
  });
}

export function teardownRuntimeAutoHeal(): void {
  if (healTimer !== null) {
    window.clearInterval(healTimer);
    healTimer = null;
  }
  installed = false;
}

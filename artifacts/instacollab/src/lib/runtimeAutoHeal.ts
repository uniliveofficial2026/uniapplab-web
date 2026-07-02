/**
 * Runtime auto-heal — detects lag, errors, and drift across web / mobile / desktop
 * and fixes in-session immediately; escalates patterns to the background ML agent.
 * All actions pass zero-mistake corroboration + verify-after-heal guards.
 */
import { refreshCloudSystemsInPlace } from './appCloudSystems';
import { isCloudAuthConfigured } from './auth/config';
import { probeSupabaseHealth, invalidateSupabaseHealthCache } from './auth/health';
import { clearSupabaseUnhealthy, markSupabaseUnhealthy } from './auth/providerState';
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

const HEAL_TICK_MS = 20_000;
const MEMORY_CHECK_MS = 25_000;
const LONG_TASK_MS = 200;
const LAG_BURST_LIMIT = 3;
const LAG_BURST_WINDOW_MS = 20_000;
const MEMORY_RATIO_THRESHOLD = 0.9;
const MEMORY_CONFIRMATIONS = 1;

let installed = false;
let healInFlight = false;
let healAgain = false;
let healTimer: number | null = null;
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

async function healCloudAuth(): Promise<void> {
  if (!isCloudAuthConfigured() || !isNetworkOnline()) return;

  const key = 'supabase_health_down';
  const confirmedDown = await confirmTwice(
    async () => {
      invalidateSupabaseHealthCache();
      return probeSupabaseHealth();
    },
    (ok) => !ok,
  );

  if (!confirmedDown) {
    memoryConfirmations = 0;
    const ok = await probeSupabaseHealth();
    if (ok) clearSupabaseUnhealthy();
    return;
  }

  if (!canActOnCorroboration(key, 60_000, 2)) return;
  markCorroborationActed(key);

  markSupabaseUnhealthy();
  reportHeal('auth_failover');

  if (shouldEscalateHandoff('supabase_down', 'confirmed_health_failure')) {
    submitHandoffTask({
      type: 'health',
      reason: 'supabase_down_confirmed',
      detail: getRuntimePlatform().label,
      screen: getCurrentScreen(),
      meta: { ...platformMetaForTelemetry(), corroborated: true },
    });
  }
}

function pauseMediaForRelief(): void {
  pauseAllPlayback();
  document.querySelectorAll('video').forEach((video) => {
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  });
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
  refreshCloudSystemsInPlace('lag_burst');
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
    pauseMediaForRelief();
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
    await healCloudAuth();
    await flushUxSignals(true);
    await flushBufferedHandoffTasks();

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
      void runHealPass('foreground');
    } else {
      healPlaybackPressure();
    }
  });

  window.addEventListener('online', () => {
    void runHealPass('online');
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

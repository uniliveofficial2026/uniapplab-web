/**
 * Runtime auto-heal — detects lag, errors, and drift across web / mobile / desktop
 * and fixes in-session immediately; escalates patterns to the background ML agent.
 */
import { refreshCloudSystemsInPlace } from './appCloudSystems';
import { flushCloudAppStateSync } from './auth/cloudAppState';
import { flushCloudProfileSync } from './auth/cloudProfile';
import { isCloudAuthConfigured } from './auth/config';
import { probeSupabaseHealth } from './auth/health';
import { clearSupabaseUnhealthy, markSupabaseUnhealthy } from './auth/providerState';
import { db } from './db/localDb';
import { flushBufferedHandoffTasks, submitHandoffTask } from './handoff';
import { healLaunchProgressForReturningUser } from './launchRoute';
import { isChunkLoadError } from './lazyWithRetry';
import { isNetworkOnline } from './networkStatus';
import { getRuntimePlatform, platformMetaForTelemetry } from './platformDetect';
import { pauseAllPlayback } from './playbackAudio';
import { pausePeerVideos } from './playbackScope';
import { stageAppUpdate } from './invisibleReload';
import { checkForPwaUpdate } from './pwaAutoUpdate';
import { flushUxSignals, getCurrentScreen, trackUx } from './uxTelemetry';
import { reconcileWalletAndKstarCoins } from './walletKstarSync';

const HEAL_TICK_MS = 90_000;
const LONG_TASK_MS = 200;
const LAG_BURST_LIMIT = 4;
const LAG_BURST_WINDOW_MS = 30_000;

let installed = false;
let healInFlight = false;
let healAgain = false;
let healTimer: ReturnType<typeof setInterval> | null = null;
let lagTimestamps: number[] = [];

function reportHeal(action: string, detail?: string): void {
  trackUx('heal', action, { ...platformMetaForTelemetry(), detail: detail ?? '' });
}

async function healSessionState(): Promise<void> {
  await db.whenStorageReady();
  if (!db.isLoggedIn || !db.currentUserId) return;

  healLaunchProgressForReturningUser(db);
  reconcileWalletAndKstarCoins(db.currentUserId);
  reportHeal('session_state', db.currentUserId.slice(0, 8));
}

async function healCloudAuth(): Promise<void> {
  if (!isCloudAuthConfigured() || !isNetworkOnline()) return;

  const ok = await probeSupabaseHealth();
  if (!ok) {
    markSupabaseUnhealthy();
    submitHandoffTask({
      type: 'health',
      reason: 'supabase_down',
      detail: getRuntimePlatform().label,
      screen: getCurrentScreen(),
      meta: platformMetaForTelemetry(),
    });
    reportHeal('auth_failover');
    return;
  }

  clearSupabaseUnhealthy();
}

async function healCloudWrites(): Promise<void> {
  if (!db.isLoggedIn || !isNetworkOnline() || !isCloudAuthConfigured()) return;

  await Promise.all([
    flushCloudAppStateSync().catch(() => undefined),
    flushCloudProfileSync().catch(() => undefined),
  ]);
  reportHeal('cloud_flush');
}

function healPlaybackPressure(): void {
  if (document.visibilityState === 'hidden') {
    pauseAllPlayback();
    pausePeerVideos();
    reportHeal('playback_paused_hidden');
  }
}

function healLayoutJank(): void {
  const root = document.documentElement;
  if (root.scrollWidth > window.innerWidth + 8) {
    root.style.overflowX = 'clip';
    document.body.style.overflowX = 'clip';
    reportHeal('layout_overflow');
  }
}

function onLagDetected(durationMs: number, source: string): void {
  const now = Date.now();
  lagTimestamps = lagTimestamps.filter((t) => now - t < LAG_BURST_WINDOW_MS);
  lagTimestamps.push(now);

  trackUx('warning', source, {
    ...platformMetaForTelemetry(),
    durationMs,
    burst: lagTimestamps.length,
  });

  if (lagTimestamps.length >= LAG_BURST_LIMIT) {
    lagTimestamps = [];
    pauseAllPlayback();
    pausePeerVideos();
    refreshCloudSystemsInPlace('lag_burst');
    reportHeal('lag_burst', source);
    submitHandoffTask({
      type: 'ux_learn',
      reason: 'lag_burst',
      detail: `${source}:${durationMs}ms`,
      screen: getCurrentScreen(),
      meta: platformMetaForTelemetry(),
    });
  }
}

function installPerformanceWatch(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  try {
    const longTask = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration < LONG_TASK_MS) continue;
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
        if ((e.duration ?? 0) < 300) continue;
        if (e.name === 'click' || e.name === 'keydown') {
          onLagDetected(Math.round(e.duration ?? 0), `slow_${e.name}`);
        }
      }
    });
    eventTiming.observe({ type: 'event', buffered: true, durationThreshold: 300 });
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
    if (ratio < 0.9) return;

    pauseAllPlayback();
    refreshCloudSystemsInPlace('memory_pressure');
    reportHeal('memory_pressure', String(Math.round(ratio * 100)));
    submitHandoffTask({
      type: 'heal',
      reason: 'memory_pressure',
      detail: `heap_${Math.round(ratio * 100)}pct`,
      screen: getCurrentScreen(),
      meta: platformMetaForTelemetry(),
    });
  };

  window.setInterval(check, HEAL_TICK_MS);
}

function installErrorEscalation(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
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
    await healCloudWrites();
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

/** Background heal tick — safe to call from cloud systems / foreground hooks. */
export function tickRuntimeAutoHeal(reason = 'tick'): void {
  void runHealPass(reason);
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

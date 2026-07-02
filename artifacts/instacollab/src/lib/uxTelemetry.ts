/**
 * Silent UX telemetry — batches signals for background ML (no UI, no handoff flood).
 */
import { handoffForIssue } from './handoff';

export type UxSignalType =
  | 'screen_view'
  | 'tap'
  | 'error'
  | 'warning'
  | 'media_fail'
  | 'heal'
  | 'rage_tap'
  | 'dwell'
  | 'intent';

export type UxSignal = {
  t: number;
  type: UxSignalType;
  screen?: string;
  detail?: string;
  meta?: Record<string, string | number | boolean>;
};

const BUFFER_KEY = 'instacollab-ux-buffer';
const SESSION_KEY = 'instacollab-ux-session';
const MAX_BUFFER = 100;
const FLUSH_MS = 120_000;

let currentScreen = 'boot';
let screenEnteredAt = Date.now();
let flushTimer: ReturnType<typeof setInterval> | null = null;
let lastTapTarget = '';
let lastTapTimes: number[] = [];

function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

function readBuffer(): UxSignal[] {
  try {
    return JSON.parse(localStorage.getItem(BUFFER_KEY) || '[]') as UxSignal[];
  } catch {
    return [];
  }
}

function writeBuffer(signals: UxSignal[]): void {
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(signals.slice(-MAX_BUFFER)));
  } catch {
    /* quota */
  }
}

export function trackUx(
  type: UxSignalType,
  detail?: string,
  meta?: UxSignal['meta'],
  screen = currentScreen,
): void {
  if (typeof window === 'undefined') return;
  if (import.meta.env.VITE_UX_TELEMETRY === 'false') return;

  const signal: UxSignal = {
    t: Date.now(),
    type,
    screen,
    detail,
    meta: { session: sessionId(), ...meta },
  };

  const buf = readBuffer();
  buf.push(signal);
  writeBuffer(buf);
}

export function trackScreen(screen: string): void {
  if (screen === currentScreen) return;
  const dwellMs = Date.now() - screenEnteredAt;
  if (dwellMs > 3000) {
    trackUx('dwell', currentScreen, { ms: dwellMs }, currentScreen);
  }
  currentScreen = screen;
  screenEnteredAt = Date.now();
  trackUx('screen_view', screen, undefined, screen);
}

function ingestUrl(): string {
  if (import.meta.env.DEV) return '/__ux/signal';
  return '/api/ux/signals';
}

export async function flushUxSignals(force = false): Promise<void> {
  if (typeof window === 'undefined') return;
  const buf = readBuffer();
  if (!buf.length) return;
  if (!force && buf.length < 15) return;

  try {
    const res = await fetch(ingestUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signals: buf }),
      keepalive: true,
    });
    if (res.ok || res.status === 204) writeBuffer([]);
  } catch {
    /* agent offline */
  }
}

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const label =
    target.getAttribute('aria-label') ||
    target.getAttribute('data-ux') ||
    `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}`.slice(0, 80);

  const now = Date.now();
  if (label === lastTapTarget) {
    lastTapTimes = lastTapTimes.filter((t) => now - t < 800);
    lastTapTimes.push(now);
    if (lastTapTimes.length >= 4) {
      trackUx('rage_tap', label, { count: lastTapTimes.length });
      handoffForIssue('rage_tap', label, currentScreen);
      lastTapTimes = [];
    }
  } else {
    lastTapTarget = label;
    lastTapTimes = [now];
  }
}

function hookErrors(): void {
  window.addEventListener('error', (event) => {
    const msg = event.message || String(event.error ?? 'error');
    trackUx('error', msg.slice(0, 300), {
      file: (event.filename || '').slice(-80),
      line: event.lineno ?? 0,
    });
    if (/posts|cloud|supabase|relation.*posts/i.test(msg)) {
      handoffForIssue('error', msg, currentScreen);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    trackUx('error', msg.slice(0, 300), { unhandled: true });
    if (/posts|cloud|supabase/i.test(msg)) {
      handoffForIssue('error', msg, currentScreen);
    }
  });
}

export function installUxTelemetry(): void {
  if (typeof window === 'undefined') return;
  if (import.meta.env.VITE_UX_TELEMETRY === 'false') return;

  hookErrors();
  document.addEventListener('click', onClick, { capture: true, passive: true });

  window.addEventListener('beforeunload', () => {
    void flushUxSignals(true);
  });

  if (!flushTimer) {
    flushTimer = window.setInterval(() => void flushUxSignals(false), FLUSH_MS);
  }
}

/**
 * Client → background handoff — silent queue only (no UI, throttled).
 * Escalations require corroborated fingerprints so the ML agent never acts on noise.
 */
import { fingerprintIssue, isNoiseSignal, shouldEscalateHandoff } from './mlGuard';
import { platformMetaForTelemetry } from './platformDetect';

export type HandoffTaskType =
  | 'heal'
  | 'deploy'
  | 'verify'
  | 'cloud_data'
  | 'health'
  | 'gemini'
  | 'ux_learn'
  | 'custom';

export type HandoffTask = {
  type: HandoffTaskType;
  reason?: string;
  detail?: string;
  screen?: string;
  meta?: Record<string, string | number | boolean>;
};

const LOCAL_QUEUE_KEY = 'instacollab-handoff-buffer';
const THROTTLE_KEY = 'instacollab-handoff-throttle';
const THROTTLE_MS = 60_000;
const THROTTLE_MS_DEPLOY = 5 * 60_000;

function handoffUrl(): string {
  if (import.meta.env.DEV) return '/__handoff/task';
  return '/api/handoff/task';
}

function isThrottled(type: string): boolean {
  try {
    const map = JSON.parse(localStorage.getItem(THROTTLE_KEY) || '{}') as Record<string, number>;
    const last = map[type] ?? 0;
    const windowMs = type === 'deploy' || type === 'gemini' ? THROTTLE_MS_DEPLOY : THROTTLE_MS;
    if (Date.now() - last < windowMs) return true;
    map[type] = Date.now();
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(map));
    return false;
  } catch {
    return false;
  }
}

function bufferTask(task: HandoffTask): void {
  try {
    const buf = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || '[]') as HandoffTask[];
    buf.push(task);
    localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(buf.slice(-30)));
  } catch {
    /* ignore */
  }
}

const HIGH_RISK_TYPES = new Set<HandoffTaskType>(['deploy', 'gemini']);

export function submitHandoffTask(task: HandoffTask): void {
  if (typeof window === 'undefined') return;
  if (import.meta.env.VITE_HANDOFF === 'false') return;
  if (isThrottled(task.type)) return;

  const detail = task.detail ?? task.reason ?? '';
  if (detail && isNoiseSignal(detail)) return;

  if (HIGH_RISK_TYPES.has(task.type) && !task.meta?.corroborated) return;

  const enriched: HandoffTask = {
    ...task,
    meta: {
      ...platformMetaForTelemetry(),
      fingerprint: fingerprintIssue(task.reason ?? task.type, detail),
      ...task.meta,
    },
  };

  bufferTask(enriched);

  void fetch(handoffUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enriched),
    keepalive: true,
  }).catch(() => {});
}

function escalate(kind: string, detail: string, screen: string | undefined, task: HandoffTask): void {
  if (!shouldEscalateHandoff(kind, detail)) return;
  submitHandoffTask({ ...task, screen, meta: { ...task.meta, corroborated: true } });
}

export function handoffForIssue(kind: string, detail: string, screen?: string): void {
  const d = detail.slice(0, 300);
  if (isNoiseSignal(d)) return;

  if (/posts|cloud|supabase|sync|cross.?device|other user|relation.*posts/i.test(d)) {
    submitHandoffTask({
      type: 'cloud_data',
      reason: kind,
      detail: d,
      screen,
      meta: { corroborated: true, immediate: true },
    });
    return;
  }

  if (kind === 'rage_tap') {
    escalate(kind, d, screen, { type: 'custom', reason: kind, detail: d });
    return;
  }

  if (kind === 'boundary_error' || kind === 'error') {
    escalate(kind, d, screen, { type: 'heal', reason: kind, detail: d });
    if (/chunk|module|import|dynamically imported/i.test(d)) {
      escalate('stale_chunk', d, screen, {
        type: 'deploy',
        reason: 'stale_chunk',
        detail: d,
        meta: { corroborated: true },
      });
    }
    return;
  }

  if (kind === 'media_fail') {
    escalate(kind, d, screen, { type: 'heal', reason: kind, detail: d });
    return;
  }

  if (kind === 'lag' || kind === 'long_task' || kind === 'warning') {
    escalate(kind, d, screen, { type: 'ux_learn', reason: kind, detail: d });
  }
}

export async function flushBufferedHandoffTasks(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const buf = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || '[]') as HandoffTask[];
    if (!buf.length) return;
    for (const task of buf.slice(-5)) {
      if (isThrottled(task.type)) continue;
      await fetch(handoffUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
        keepalive: true,
      }).catch(() => {});
    }
    localStorage.setItem(LOCAL_QUEUE_KEY, '[]');
  } catch {
    /* ignore */
  }
}

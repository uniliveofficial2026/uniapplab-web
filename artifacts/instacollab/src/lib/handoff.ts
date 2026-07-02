/**
 * Client → background handoff — silent queue only (no UI, throttled).
 */
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
const THROTTLE_MS = 5 * 60_000;

function handoffUrl(): string {
  if (import.meta.env.DEV) return '/__handoff/task';
  return '/api/handoff/task';
}

function isThrottled(type: string): boolean {
  try {
    const map = JSON.parse(localStorage.getItem(THROTTLE_KEY) || '{}') as Record<string, number>;
    const last = map[type] ?? 0;
    if (Date.now() - last < THROTTLE_MS) return true;
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

export function submitHandoffTask(task: HandoffTask): void {
  if (typeof window === 'undefined') return;
  if (import.meta.env.VITE_HANDOFF === 'false') return;
  if (isThrottled(task.type)) return;

  const enriched: HandoffTask = {
    ...task,
    meta: { ...platformMetaForTelemetry(), ...task.meta },
  };

  bufferTask(enriched);

  void fetch(handoffUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enriched),
    keepalive: true,
  }).catch(() => {});
}

export function handoffForIssue(kind: string, detail: string, screen?: string): void {
  const d = detail.slice(0, 300);

  if (/posts|cloud|supabase|sync|cross.?device|other user|relation.*posts/i.test(d)) {
    submitHandoffTask({ type: 'cloud_data', reason: kind, detail: d, screen });
    return;
  }

  if (kind === 'rage_tap') {
    submitHandoffTask({ type: 'custom', reason: kind, detail: d, screen });
    return;
  }

  if (kind === 'boundary_error' || kind === 'error') {
    submitHandoffTask({ type: 'heal', reason: kind, detail: d, screen });
    if (/chunk|module|import|dynamically imported/i.test(d)) {
      submitHandoffTask({ type: 'deploy', reason: 'stale_chunk', detail: d, screen });
    }
    return;
  }

  if (kind === 'media_fail') {
    submitHandoffTask({ type: 'heal', reason: kind, detail: d, screen });
    return;
  }

  if (kind === 'lag' || kind === 'long_task' || kind === 'warning') {
    submitHandoffTask({ type: 'ux_learn', reason: kind, detail: d, screen });
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

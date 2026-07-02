/**
 * Immediate ML reaction — detect → safe fix now → verify → flush to agent.
 * Risky actions (deploy/gemini) still require corroboration via mlGuard + handoff.
 */
import { refreshCloudSystemsInPlace } from './appCloudSystems';
import { flushBufferedHandoffTasks, handoffForIssue, submitHandoffTask } from './handoff';
import { isCriticalCloudIssue, isNoiseSignal } from './mlGuard';
import { platformMetaForTelemetry } from './platformDetect';
import { reactImmediately } from './runtimeAutoHeal';
import { flushUxSignals, getCurrentScreen } from './uxTelemetry';

let flushScheduled = false;

function scheduleAgentFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    void flushUxSignals(true);
    void flushBufferedHandoffTasks();
  });
}

/** Called the moment an issue is detected — fixes safe cases instantly, escalates verified cloud faults. */
export function reactToMlIssue(kind: string, detail: string, screen?: string): void {
  if (typeof window === 'undefined') return;
  const d = detail.slice(0, 300);
  if (isNoiseSignal(d)) return;

  const activeScreen = screen ?? getCurrentScreen();
  reactImmediately(`react:${kind}`);

  if (isCriticalCloudIssue(d)) {
    refreshCloudSystemsInPlace(`react:${kind}`);
    submitHandoffTask({
      type: 'cloud_data',
      reason: kind,
      detail: d,
      screen: activeScreen,
      meta: { ...platformMetaForTelemetry(), corroborated: true, immediate: true },
    });
  } else {
    handoffForIssue(kind, d, activeScreen);
  }

  scheduleAgentFlush();
}

import type { RefObject } from 'react';

export type ThoughtBubblePortalRegistration = {
  instanceId: number;
  userId: string;
  anchorRef: RefObject<HTMLElement | null>;
  noteText: string;
  onOpen: () => void;
  intersectionRatio: number;
  isIntersecting: boolean;
};

let nextInstanceId = 0;
const registry = new Map<number, ThoughtBubblePortalRegistration>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeThoughtBubblePortal(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerThoughtBubblePortal(
  entry: Omit<
    ThoughtBubblePortalRegistration,
    'instanceId' | 'intersectionRatio' | 'isIntersecting'
  >
): number {
  const instanceId = ++nextInstanceId;
  registry.set(instanceId, {
    ...entry,
    instanceId,
    intersectionRatio: 0,
    isIntersecting: false,
  });
  notify();
  return instanceId;
}

export function unregisterThoughtBubblePortal(instanceId: number) {
  registry.delete(instanceId);
  notify();
}

export function updateThoughtBubblePortalVisibility(
  instanceId: number,
  intersectionRatio: number,
  isIntersecting: boolean
) {
  const entry = registry.get(instanceId);
  if (!entry) return;
  entry.intersectionRatio = intersectionRatio;
  entry.isIntersecting = isIntersecting;
  notify();
}

/** One portaled bubble per user — the anchor with the strongest in-view presence wins. */
export function pickActiveThoughtBubblePortal(userId: string): number | null {
  let best: ThoughtBubblePortalRegistration | null = null;

  for (const entry of registry.values()) {
    if (entry.userId !== userId) continue;
    if (!entry.isIntersecting || entry.intersectionRatio < 0.35) continue;
    if (!best || entry.intersectionRatio > best.intersectionRatio) {
      best = entry;
    }
  }

  return best?.instanceId ?? null;
}

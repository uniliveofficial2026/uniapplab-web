/** Priority: higher wins when multiple surfaces want sound at once. */
export const PLAYBACK_PRIORITY = {
  EDITOR: 200,
  MODAL_FS: 105,
  MODAL: 100,
  POST_FS: 90,
  STORY: 85,
  REEL_FS: 81,
  REEL: 80,
  FEED: 50,
} as const;

type PlaybackRequest = {
  priority: number;
  wantsPlay: boolean;
};

/** Per playback id, multiple surfaces (feed, modal, etc.) register play intent. */
const requests = new Map<string, Map<string, PlaybackRequest>>();
/** Per playback id + surface key (feed, modal, canonical, …). */
const elements = new Map<string, Map<string, HTMLMediaElement>>();
let activeId: string | null = null;
let activeSourceKey: string | null = null;
const listeners = new Set<() => void>();

let reconcileScheduled = false;
let coordinatorApplyingPlayback = false;

/** @deprecated Handoffs removed — always false (prevents duplicate play paths). */
export function hasPendingPlaybackHandoff(_id: string): boolean {
  return false;
}

/** @deprecated No-op; kept so callers do not need churn. */
export function snapshotPlaybackHandoff(_id: string, _incomingSourceKey: string) {
  /* single-winner playback — never run two elements for one id */
}

/** True while the coordinator is calling play()/pause() (ignore global play handler). */
export function isPlaybackCoordinatorApplying(): boolean {
  return coordinatorApplyingPlayback;
}

function notify() {
  listeners.forEach((fn) => fn());
}

function effectiveRequestForId(id: string): PlaybackRequest | null {
  const intents = requests.get(id);
  if (!intents?.size) return null;
  let best: PlaybackRequest | null = null;
  for (const intent of intents.values()) {
    if (!intent.wantsPlay) continue;
    if (!best || intent.priority > best.priority) {
      best = intent;
    }
  }
  return best;
}

function winningSourceKeyForId(id: string): string | null {
  const intents = requests.get(id);
  if (!intents) return null;
  let bestKey: string | null = null;
  let bestPri = -1;
  for (const [key, intent] of intents) {
    if (!intent.wantsPlay) continue;
    if (intent.priority > bestPri) {
      bestPri = intent.priority;
      bestKey = key;
    }
  }
  return bestKey;
}

function getElement(id: string, sourceKey: string): HTMLMediaElement | null {
  return elements.get(id)?.get(sourceKey) ?? null;
}

/** Resolve DOM node: shared canonical element or per-surface element. */
function resolvePlayTarget(
  id: string
): { sourceKey: string; el: HTMLMediaElement } | null {
  const sources = elements.get(id);
  if (!sources) return null;
  if (!effectiveRequestForId(id)) return null;

  const intentKey = winningSourceKeyForId(id);
  if (!intentKey) return null;
  const canonical = sources.get('canonical');
  if (canonical) {
    return { sourceKey: 'canonical', el: canonical };
  }
  const surface = sources.get(intentKey);
  if (surface) {
    return { sourceKey: intentKey, el: surface };
  }
  return null;
}

function pickActive(): { id: string; sourceKey: string } | null {
  let best: { id: string; sourceKey: string; priority: number } | null = null;
  for (const [id] of requests) {
    const req = effectiveRequestForId(id);
    const target = resolvePlayTarget(id);
    if (!req || !target) continue;
    if (!best || req.priority > best.priority) {
      best = { id, sourceKey: target.sourceKey, priority: req.priority };
    }
  }
  return best ? { id: best.id, sourceKey: best.sourceKey } : null;
}

function applyPlayback() {
  coordinatorApplyingPlayback = true;
  try {
    for (const [id, sources] of elements) {
      const wantsWinner = id === activeId && !!effectiveRequestForId(id);
      for (const [sourceKey, el] of sources) {
        const isWinner = id === activeId && sourceKey === activeSourceKey;
        if (isWinner && wantsWinner) {
          if (el.paused) {
            void el.play().catch(() => {});
          }
        } else if (!el.paused) {
          el.pause();
        }
      }
    }
  } finally {
    queueMicrotask(() => {
      coordinatorApplyingPlayback = false;
    });
  }
}

function reconcile() {
  const next = pickActive();
  const activeMissing =
    activeId !== null &&
    activeSourceKey !== null &&
    !getElement(activeId, activeSourceKey);
  if (
    next?.id === activeId &&
    next?.sourceKey === activeSourceKey &&
    !activeMissing
  ) {
    applyPlayback();
    return;
  }
  activeId = next?.id ?? null;
  activeSourceKey = next?.sourceKey ?? null;
  applyPlayback();
  notify();
}

function scheduleReconcile() {
  if (reconcileScheduled) return;
  reconcileScheduled = true;
  requestAnimationFrame(() => {
    reconcileScheduled = false;
    reconcile();
  });
}

/** Re-run winner selection after carousel src change (managed videos only). */
export function requestPlaybackReconcile(): void {
  scheduleReconcile();
}

export function subscribePlayback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActivePlaybackId(): string | null {
  return activeId;
}

export function registerPlaybackElement(
  id: string,
  sourceKey: string,
  el: HTMLMediaElement | null
) {
  if (el) {
    let sources = elements.get(id);
    if (!sources) {
      sources = new Map();
      elements.set(id, sources);
    }
    sources.set(sourceKey, el);
  } else {
    const sources = elements.get(id);
    sources?.delete(sourceKey);
    if (sources?.size === 0) {
      elements.delete(id);
    }
    if (activeId === id && activeSourceKey === sourceKey) {
      activeId = null;
      activeSourceKey = null;
    }
  }
  scheduleReconcile();
}

export function setPlaybackIntent(
  id: string,
  intentKey: string,
  priority: number,
  wantsPlay: boolean
) {
  let intents = requests.get(id);
  if (!intents) {
    intents = new Map();
    requests.set(id, intents);
  }
  intents.set(intentKey, { priority, wantsPlay });
  scheduleReconcile();
}

export function clearPlaybackIntent(id: string, intentKey: string) {
  const intents = requests.get(id);
  if (!intents) return;
  intents.delete(intentKey);
  if (intents.size === 0) {
    requests.delete(id);
  }
  scheduleReconcile();
}

/** Re-enable feed playback before modal teardown. */
export function boostFeedPlaybackIntent(
  id: string,
  surface: 'soundtrack' | 'text-audio' | 'video' = 'video'
) {
  const playbackId = id.includes(':') ? id : `post:${id}:${surface}`;
  const intents = requests.get(playbackId);
  if (!intents?.has('feed')) return;
  setPlaybackIntent(playbackId, 'feed', PLAYBACK_PRIORITY.FEED, true);
}

/**
 * Pause and seek to start for one playback id.
 * Does not reconcile immediately — avoids replay while React effects still hold stale wantsPlay.
 */
export function resetPlaybackMedia(playbackId: string) {
  const sources = elements.get(playbackId);
  if (sources) {
    for (const el of sources.values()) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
  }
  if (activeId === playbackId) {
    activeId = null;
    activeSourceKey = null;
  }
  notify();
}

/** Stop everything (e.g. tab backgrounded). */
export function pauseAllPlayback() {
  activeId = null;
  activeSourceKey = null;
  for (const sources of elements.values()) {
    for (const el of sources.values()) {
      el.pause();
    }
  }
  notify();
}

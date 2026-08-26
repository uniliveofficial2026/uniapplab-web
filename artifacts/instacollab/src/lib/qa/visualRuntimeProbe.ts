/**
 * QA-only visual / animation temporal probe.
 * Activated by:
 *   localStorage.UNILIVE_QA_VISUAL = '1'
 *   or URL ?qaVisual=1
 *   or Capacitor native + window.__UNILIVE_QA_FORCE__
 *
 * Exposes:
 *   window.__UNILIVE_QA_VISUAL_SNAPSHOT__
 *   document.documentElement dataset.qaVisualSummary (redacted short)
 *   landmark aria-label="qa-visual-probe" with JSON summary
 */

export type QaVisualSample = {
  id: string;
  kind: 'css' | 'video' | 'image' | 'other';
  playState?: string;
  t0?: number;
  t1?: number;
  progressed: boolean;
  width: number;
  height: number;
  visible: boolean;
  animationName?: string;
};

export type QaVisualSnapshot = {
  at: number;
  route: string;
  visibilityState: string;
  reducedMotion: boolean;
  muteAnimations: boolean;
  spaEntry: string;
  samples: QaVisualSample[];
  passCritical: boolean;
};

function qaEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if ((window as { __UNILIVE_QA_FORCE__?: boolean }).__UNILIVE_QA_FORCE__) return true;
    if (new URLSearchParams(window.location.search).get('qaVisual') === '1') return true;
    if (window.localStorage?.getItem('UNILIVE_QA_VISUAL') === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

function spaEntryFromDom(): string {
  try {
    const scripts = Array.from(document.scripts);
    for (const s of scripts) {
      const src = s.getAttribute('src') || '';
      const m = src.match(/assets\/(index-[^/]+\.js)/);
      if (m) return m[1];
    }
  } catch {
    /* ignore */
  }
  return '';
}

function rectOk(el: Element): { width: number; height: number; visible: boolean } {
  const r = (el as HTMLElement).getBoundingClientRect?.() ?? { width: 0, height: 0 };
  const style = window.getComputedStyle(el);
  const visible =
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity || '1') > 0.01 &&
    r.width > 0 &&
    r.height > 0;
  return { width: r.width, height: r.height, visible };
}

function sampleCssAnimations(root: ParentNode): QaVisualSample[] {
  const out: QaVisualSample[] = [];
  const selectors = [
    '.avatar-ring-spinner--live',
    '.avatar-ring-spinner--story',
    '.avatar-ring-spinner',
    '.thought-bubble-living',
    '.v14-animated-artwork__image',
    '[data-unilives-inapp-loading] [data-motion="video"]',
    '[data-unilives-princess-loading-refresh] video',
    'video[data-motion="video"]',
  ];
  for (const sel of selectors) {
    const els = Array.from(root.querySelectorAll(sel)).slice(0, 4);
    for (const el of els) {
      const geo = rectOk(el);
      if (el instanceof HTMLVideoElement) {
        const t0 = el.currentTime || 0;
        out.push({
          id: sel,
          kind: 'video',
          t0,
          t1: t0,
          progressed: false,
          ...geo,
        });
        continue;
      }
      const anims =
        typeof (el as HTMLElement).getAnimations === 'function'
          ? (el as HTMLElement).getAnimations()
          : [];
      if (!anims.length) {
        out.push({
          id: sel,
          kind: 'css',
          playState: 'none',
          progressed: false,
          ...geo,
        });
        continue;
      }
      for (const a of anims.slice(0, 2)) {
        const effect = a.effect as KeyframeEffect | null;
        const name =
          (effect && 'animationName' in (a as unknown as { animationName?: string })
            ? (a as unknown as { animationName?: string }).animationName
            : undefined) ||
          (a as Animation & { animationName?: string }).animationName ||
          'unknown';
        const t0 = typeof a.currentTime === 'number' ? a.currentTime : Number(a.currentTime) || 0;
        out.push({
          id: `${sel}:${name}`,
          kind: 'css',
          playState: a.playState,
          animationName: String(name),
          t0,
          t1: t0,
          progressed: false,
          ...geo,
        });
      }
    }
  }
  return out;
}

async function measureProgress(samples: QaVisualSample[], waitMs = 450): Promise<QaVisualSample[]> {
  await new Promise((r) => setTimeout(r, waitMs));
  return samples.map((s) => {
    if (s.kind === 'video') {
      const videos = Array.from(document.querySelectorAll('video'));
      const v =
        videos.find((el) => el.matches('[data-motion="video"], [data-unilives-inapp-loading] video')) ||
        videos[0];
      const t1 = v?.currentTime ?? s.t0 ?? 0;
      const t0 = s.t0 ?? 0;
      return { ...s, t1, progressed: t1 > t0 + 0.05 };
    }
    const [sel] = s.id.split(':');
    const el = document.querySelector(sel);
    if (!el || typeof (el as HTMLElement).getAnimations !== 'function') {
      return { ...s, progressed: false };
    }
    const anims = (el as HTMLElement).getAnimations();
    const match =
      anims.find((a) => {
        const n = (a as Animation & { animationName?: string }).animationName;
        return !s.animationName || n === s.animationName || s.id.includes(String(n));
      }) || anims[0];
    if (!match) return { ...s, playState: 'none', progressed: false };
    const t1 = typeof match.currentTime === 'number' ? match.currentTime : Number(match.currentTime) || 0;
    const t0 = s.t0 ?? 0;
    return {
      ...s,
      playState: match.playState,
      t1,
      progressed: match.playState === 'running' && t1 > t0,
    };
  });
}

function ensureLandmark(summary: string): void {
  let node = document.getElementById('qa-visual-probe');
  if (!node) {
    node = document.createElement('div');
    node.id = 'qa-visual-probe';
    node.setAttribute('role', 'status');
    node.style.cssText =
      'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:2147483646';
    document.body.appendChild(node);
  }
  node.setAttribute('aria-label', `qa-visual-probe ${summary}`);
  document.documentElement.dataset.qaVisualSummary = summary.slice(0, 180);
}

export async function runQaVisualProbe(): Promise<QaVisualSnapshot | null> {
  if (!qaEnabled()) return null;
  let muteAnimations = false;
  try {
    const mod = await import('../unilives-assets/featureFlags');
    muteAnimations = Boolean(mod.getAssetFeatureFlags().muteAnimations);
  } catch {
    /* ignore */
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = sampleCssAnimations(document);
  const samples = await measureProgress(base);
  const criticalIds = [
    'thought-bubble',
    'avatar-ring-spinner',
    'data-motion',
    'v14-animated',
  ];
  const critical = samples.filter((s) => criticalIds.some((c) => s.id.includes(c)));
  const passCritical =
    critical.length === 0
      ? samples.some((s) => s.progressed)
      : critical.some((s) => s.progressed || (s.visible && s.kind === 'video' && s.progressed));

  const snap: QaVisualSnapshot = {
    at: Date.now(),
    route: `${window.location.pathname}${window.location.search}`,
    visibilityState: document.visibilityState,
    reducedMotion,
    muteAnimations,
    spaEntry: spaEntryFromDom(),
    samples,
    passCritical,
  };
  (window as { __UNILIVE_QA_VISUAL_SNAPSHOT__?: QaVisualSnapshot }).__UNILIVE_QA_VISUAL_SNAPSHOT__ =
    snap;
  const progressed = samples.filter((s) => s.progressed).length;
  ensureLandmark(
    JSON.stringify({
      spa: snap.spaEntry,
      vis: snap.visibilityState,
      rm: snap.reducedMotion,
      mute: snap.muteAnimations,
      n: samples.length,
      ok: progressed,
      pass: snap.passCritical,
    }),
  );
  return snap;
}

let started = false;
export function startQaVisualProbeLoop(): void {
  if (started || typeof window === 'undefined') return;
  if (!qaEnabled()) return;
  started = true;
  const tick = () => {
    void runQaVisualProbe().finally(() => {
      window.setTimeout(tick, 2000);
    });
  };
  if (document.readyState === 'complete') tick();
  else window.addEventListener('load', () => tick(), { once: true });
}

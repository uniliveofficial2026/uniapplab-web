/**
 * Single-source live mirror stream (left canvas → admin Inspect).
 * Stable: latest-wins, capped FPS, no overlapping paints, reusable canvases.
 */

import {
  ADMIN_UI_PICK_FRAME,
  ADMIN_UI_PICK_MIRROR_SET,
  isAdminPanelMessage,
  resolveAdminPanelOrigin,
} from './adminUiPickProtocol';

const SKIP = new Set(['SCRIPT', 'LINK', 'STYLE', 'NOSCRIPT']);
const MAX_NODES = 140;
const MAX_EDGE = 420;
const MIN_FRAME_MS = 50; // ~20fps — stable, not rAF-thundering

function isTransparent(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'rgba(0,0,0,0)';
}

function parentTarget(): string {
  const params = new URLSearchParams(window.location.search);
  return resolveAdminPanelOrigin(params.get('adminOrigin')) || '*';
}

/** Start streaming THIS embed's pixels to the admin Inspect canvas. */
export function startAdminLiveMirrorStream(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (window.parent === window) return () => undefined;
  if (new URLSearchParams(window.location.search).get('mirror') === '1') return () => undefined;

  const canvas = document.createElement('canvas');
  const scratch = document.createElement('canvas');
  let enabled = true;
  let inFlight = false;
  let needsAnother = false;
  let frameNo = 0;
  let raf = 0;
  let stopped = false;
  let origin = parentTarget();
  let lastSentAt = 0;

  const safeDraw = (
    ctx: CanvasRenderingContext2D,
    node: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): boolean => {
    const tw = Math.max(1, Math.round(dw));
    const th = Math.max(1, Math.round(dh));
    if (scratch.width !== tw || scratch.height !== th) {
      scratch.width = tw;
      scratch.height = th;
    }
    const tctx = scratch.getContext('2d');
    if (!tctx) return false;
    try {
      tctx.clearRect(0, 0, tw, th);
      tctx.drawImage(node, 0, 0, tw, th);
      // Probe taint without encoding a huge JPEG every time.
      tctx.getImageData(0, 0, 1, 1);
      ctx.drawImage(scratch, dx, dy, dw, dh);
      return true;
    } catch {
      return false;
    }
  };

  const paintFrame = (fullUi: boolean) => {
    const root =
      (document.querySelector('[data-admin-embed-app]') as HTMLElement | null) ||
      document.getElementById('root') ||
      document.body;
    if (!root) return null;

    const rect = root.getBoundingClientRect();
    const width = Math.max(1, Math.round(Math.min(rect.width || window.innerWidth, window.innerWidth)));
    const height = Math.max(1, Math.round(Math.min(rect.height || window.innerHeight, window.innerHeight)));
    if (width < 8 || height < 8) return null;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const cw = Math.max(1, Math.round(width * scale));
    const ch = Math.max(1, Math.round(height * scale));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return null;

    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const rootBg = getComputedStyle(root).backgroundColor;
    ctx.fillStyle = !isTransparent(rootBg) ? rootBg : !isTransparent(bodyBg) ? bodyBg : '#0b1020';
    ctx.fillRect(0, 0, cw, ch);

    let budget = MAX_NODES;
    const walk = (el: Element) => {
      if (budget <= 0) return;
      if (el.hasAttribute('data-admin-ui-pick-overlay') || SKIP.has(el.tagName)) return;
      budget -= 1;
      const r = el.getBoundingClientRect();
      const w = r.width * scale;
      const h = r.height * scale;
      if (w < 0.5 || h < 0.5) return;
      if (r.bottom < rect.top || r.right < rect.left || r.top > rect.bottom || r.left > rect.right) return;
      const x = (r.left - rect.left) * scale;
      const y = (r.top - rect.top) * scale;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return;

      if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement) {
        if (el instanceof HTMLImageElement && !el.naturalWidth) return;
        if (el instanceof HTMLVideoElement && el.readyState < 2) return;
        if (el instanceof HTMLCanvasElement && (!el.width || !el.height)) return;
        safeDraw(ctx, el, x, y, w, h);
        return;
      }

      if (fullUi) {
        const bg = cs.backgroundColor;
        if (!isTransparent(bg)) {
          ctx.fillStyle = bg;
          ctx.fillRect(x, y, w, h);
        }
        if (el.childElementCount === 0) {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (text) {
            const fontSize = Math.max(8, (Number.parseFloat(cs.fontSize) || 12) * scale);
            ctx.fillStyle = cs.color || '#e8eefc';
            ctx.font = `${cs.fontWeight || 400} ${fontSize}px ${cs.fontFamily || 'sans-serif'}`;
            ctx.textBaseline = 'middle';
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.clip();
            ctx.fillText(text.slice(0, 64), x + 3 * scale, y + h / 2, Math.max(8, w - 6 * scale));
            ctx.restore();
          }
        }
      }

      for (let i = 0; i < el.children.length; i += 1) walk(el.children[i]!);
    };

    walk(root);

    const media = root.querySelectorAll('video, img, canvas');
    for (let i = 0; i < media.length; i += 1) {
      const node = media[i]!;
      if (!(node instanceof HTMLImageElement || node instanceof HTMLVideoElement || node instanceof HTMLCanvasElement)) continue;
      if (node instanceof HTMLImageElement && !node.naturalWidth) continue;
      if (node instanceof HTMLVideoElement && node.readyState < 2) continue;
      const r = node.getBoundingClientRect();
      const w = r.width * scale;
      const h = r.height * scale;
      if (w < 1 || h < 1) continue;
      safeDraw(ctx, node, (r.left - rect.left) * scale, (r.top - rect.top) * scale, w, h);
    }

    return { width, height, originTop: rect.top, originLeft: rect.left };
  };

  const sendFrame = async () => {
    if (stopped || !enabled) {
      inFlight = false;
      return;
    }
    const now = performance.now();
    if (now - lastSentAt < MIN_FRAME_MS) {
      inFlight = false;
      if (needsAnother) {
        needsAnother = false;
        schedule();
      }
      return;
    }

    frameNo += 1;
    try {
      const meta = paintFrame(frameNo % 2 === 0);
      if (!meta) return;

      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(canvas);
      } catch {
        bitmap = null;
      }

      // Prefer transferable bitmap; fall back to compact JPEG if transfer path fails.
      if (bitmap) {
        try {
          window.parent.postMessage(
            {
              type: ADMIN_UI_PICK_FRAME,
              bitmap,
              width: meta.width,
              height: meta.height,
              originTop: meta.originTop,
              originLeft: meta.originLeft,
              at: Date.now(),
            },
            origin,
            [bitmap],
          );
          bitmap = null;
          lastSentAt = performance.now();
        } catch {
          try {
            window.parent.postMessage(
              {
                type: ADMIN_UI_PICK_FRAME,
                bitmap,
                width: meta.width,
                height: meta.height,
                originTop: meta.originTop,
                originLeft: meta.originLeft,
                at: Date.now(),
              },
              '*',
              [bitmap!],
            );
            bitmap = null;
            lastSentAt = performance.now();
          } catch {
            try {
              bitmap?.close();
            } catch {
              /* ignore */
            }
            bitmap = null;
          }
        }
      }

      if (bitmap === null && lastSentAt < now) {
        // Bitmap path failed entirely — JPEG fallback (still one source).
        let dataUrl: string | null = null;
        try {
          dataUrl = canvas.toDataURL('image/jpeg', 0.55);
        } catch {
          dataUrl = null;
        }
        if (dataUrl) {
          try {
            window.parent.postMessage(
              {
                type: ADMIN_UI_PICK_FRAME,
                dataUrl,
                width: meta.width,
                height: meta.height,
                originTop: meta.originTop,
                originLeft: meta.originLeft,
                at: Date.now(),
              },
              origin,
            );
            lastSentAt = performance.now();
          } catch {
            try {
              window.parent.postMessage(
                {
                  type: ADMIN_UI_PICK_FRAME,
                  dataUrl,
                  width: meta.width,
                  height: meta.height,
                  originTop: meta.originTop,
                  originLeft: meta.originLeft,
                  at: Date.now(),
                },
                '*',
              );
              lastSentAt = performance.now();
            } catch {
              /* ignore */
            }
          }
        }
      }
    } finally {
      inFlight = false;
      if (needsAnother && !stopped && enabled) {
        needsAnother = false;
        schedule();
      }
    }
  };

  const schedule = () => {
    if (stopped || !enabled) return;
    if (inFlight) {
      needsAnother = true;
      return;
    }
    inFlight = true;
    void sendFrame();
  };

  const onMessage = (event: MessageEvent) => {
    if (!isAdminPanelMessage(event)) return;
    const data = event.data as { type?: string; payload?: { enabled?: boolean } } | null;
    if (!data?.type) return;
    if (data.type === ADMIN_UI_PICK_MIRROR_SET) {
      origin = event.origin || origin;
      const next = Boolean(data.payload?.enabled);
      enabled = next;
      if (next) schedule();
    }
  };
  window.addEventListener('message', onMessage);

  const pump = () => {
    if (stopped) return;
    raf = window.requestAnimationFrame(pump);
    schedule();
  };
  raf = window.requestAnimationFrame(pump);

  // Kick immediately so Inspect is not waiting on the first MIRROR_SET race.
  schedule();

  return () => {
    stopped = true;
    enabled = false;
    if (raf) window.cancelAnimationFrame(raf);
    window.removeEventListener('message', onMessage);
  };
}

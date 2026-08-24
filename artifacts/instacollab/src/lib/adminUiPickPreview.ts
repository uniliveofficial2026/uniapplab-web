import type { AdminUiPickSelection, AdminUiPickSnapshot } from './adminUiPickProtocol';

const STYLE_PROPS = [
  'display',
  'position',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin',
  'padding',
  'border',
  'border-radius',
  'background',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'color',
  'font',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-overflow',
  'white-space',
  'overflow',
  'overflow-x',
  'overflow-y',
  'opacity',
  'box-shadow',
  'filter',
  'backdrop-filter',
  'transform',
  'align-items',
  'justify-content',
  'flex',
  'flex-direction',
  'flex-wrap',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'object-fit',
  'object-position',
  'visibility',
  'clip-path',
  'z-index',
  'outline',
  'caret-color',
];

const SKIP_TAGS = new Set(['SCRIPT', 'LINK', 'STYLE', 'NOSCRIPT']);
const MAX_NODES = 80;
const MAX_PAINT_NODES = 220;
const VIEWPORT_MAX_EDGE = 420;

function copyVisualStyle(source: Element, target: HTMLElement): void {
  const cs = getComputedStyle(source);
  const parts: string[] = [];
  for (const prop of STYLE_PROPS) {
    const value = cs.getPropertyValue(prop);
    if (value) parts.push(`${prop}:${value}`);
  }
  target.style.cssText = parts.join(';');
}

function absoluteUrl(raw: string | null | undefined): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    return new URL(value, document.baseURI).href;
  } catch {
    return value;
  }
}

function cloneStyled(source: Element, budget: { left: number }): HTMLElement | SVGElement {
  const clone = source.cloneNode(false) as HTMLElement | SVGElement;
  if (clone instanceof HTMLElement) copyVisualStyle(source, clone);

  if (clone instanceof HTMLImageElement) {
    const img = source as HTMLImageElement;
    clone.src = img.currentSrc || absoluteUrl(img.src);
    clone.alt = img.alt;
  }
  if (clone instanceof HTMLVideoElement) {
    const video = source as HTMLVideoElement;
    clone.src = video.currentSrc || absoluteUrl(video.src);
    clone.muted = true;
    clone.autoplay = false;
    clone.controls = false;
    clone.playsInline = true;
  }
  if (clone instanceof HTMLAnchorElement) {
    clone.removeAttribute('href');
  }

  if (budget.left <= 0) return clone;
  for (const child of Array.from(source.childNodes)) {
    if (budget.left <= 0) break;
    if (child.nodeType === Node.TEXT_NODE) {
      clone.appendChild(document.createTextNode(child.textContent || ''));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    if (SKIP_TAGS.has(el.tagName) || el.hasAttribute('data-admin-ui-pick-overlay')) continue;
    budget.left -= 1;
    clone.appendChild(cloneStyled(el, budget));
  }
  return clone;
}

function serializeHtml(el: Element, width: number, height: number, maxNodes = MAX_NODES): string {
  const clone = cloneStyled(el, { left: maxNodes });
  if (clone instanceof HTMLElement) {
    clone.style.width = `${Math.max(1, Math.round(width))}px`;
    clone.style.height = `${Math.max(1, Math.round(height))}px`;
    clone.style.margin = '0';
    clone.style.maxWidth = 'none';
    clone.style.maxHeight = 'none';
    clone.style.transform = 'none';
    clone.style.position = 'relative';
    clone.style.inset = 'auto';
    clone.style.left = 'auto';
    clone.style.top = 'auto';
  }
  return clone.outerHTML;
}

function isTransparentColor(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'rgba(0,0,0,0)';
}

function safeDrawMedia(
  ctx: CanvasRenderingContext2D,
  node: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): boolean {
  try {
    const tw = Math.max(1, Math.round(dw));
    const th = Math.max(1, Math.round(dh));
    const tmp = document.createElement('canvas');
    tmp.width = tw;
    tmp.height = th;
    const tctx = tmp.getContext('2d');
    if (!tctx) return false;
    tctx.drawImage(node, 0, 0, tw, th);
    // Throws if the media tainted the temp canvas (cross-origin without CORS).
    void tmp.toDataURL('image/jpeg', 0.5);
    ctx.drawImage(tmp, dx, dy, dw, dh);
    return true;
  } catch {
    return false;
  }
}

function paintApproxDom(
  root: Element,
  ctx: CanvasRenderingContext2D,
  rootRect: DOMRect,
  scale: number,
  budget: { left: number },
): void {
  if (budget.left <= 0) return;
  const walk = (el: Element) => {
    if (budget.left <= 0) return;
    if (el.hasAttribute('data-admin-ui-pick-overlay') || SKIP_TAGS.has(el.tagName)) return;
    budget.left -= 1;

    const rect = el.getBoundingClientRect();
    const w = rect.width * scale;
    const h = rect.height * scale;
    if (w < 0.5 || h < 0.5) return;
    if (rect.bottom < rootRect.top || rect.right < rootRect.left || rect.top > rootRect.bottom || rect.left > rootRect.right) {
      return;
    }

    const x = (rect.left - rootRect.left) * scale;
    const y = (rect.top - rootRect.top) * scale;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return;

    const bg = cs.backgroundColor;
    if (!isTransparentColor(bg)) {
      ctx.fillStyle = bg;
      const radius = Math.min(Number.parseFloat(cs.borderRadius) || 0, Math.min(w, h) / 2) * scale;
      if (radius > 0.5) {
        const r = Math.min(radius, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
    }

    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement) {
      if (el instanceof HTMLImageElement && !el.naturalWidth) return;
      if (el instanceof HTMLVideoElement && el.readyState < 2) return;
      if (el instanceof HTMLCanvasElement && (!el.width || !el.height)) return;
      safeDrawMedia(ctx, el, x, y, w, h);
      return;
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
        ctx.fillText(text.slice(0, 80), x + 4 * scale, y + h / 2, Math.max(8, w - 8 * scale));
        ctx.restore();
      }
    }

    for (const child of Array.from(el.children)) walk(child);
  };

  walk(root);
}

function drawMediaLayer(root: Element, ctx: CanvasRenderingContext2D, scale: number): boolean {
  const rootRect = root.getBoundingClientRect();
  const media = [root, ...Array.from(root.querySelectorAll('img, video, canvas'))];
  let drew = false;
  for (const node of media) {
    if (!(node instanceof HTMLImageElement || node instanceof HTMLVideoElement || node instanceof HTMLCanvasElement)) continue;
    if (node instanceof HTMLImageElement && !node.naturalWidth) continue;
    if (node instanceof HTMLVideoElement && node.readyState < 2) continue;
    const rect = node.getBoundingClientRect();
    const w = rect.width * scale;
    const h = rect.height * scale;
    if (w < 1 || h < 1) continue;
    if (safeDrawMedia(ctx, node, (rect.left - rootRect.left) * scale, (rect.top - rootRect.top) * scale, w, h)) {
      drew = true;
    }
  }
  return drew;
}

async function rasterizeSelection(el: Element, width: number, height: number, maxNodes = MAX_NODES): Promise<string | null> {
  const scale = Math.min(2, 720 / Math.max(width, height, 1));
  const cw = Math.max(1, Math.round(width * scale));
  const ch = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bg = getComputedStyle(el).backgroundColor || '#0b1020';
  ctx.fillStyle = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' ? '#0b1020' : bg;
  ctx.fillRect(0, 0, cw, ch);
  drawMediaLayer(el, ctx, scale);

  const html = serializeHtml(el, width, height, maxNodes);
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
      <foreignObject width="100%" height="100%" style="background:transparent">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${cw}px;height:${ch}px;transform:scale(${scale});transform-origin:top left">${html}</div>
      </foreignObject>
    </svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, cw, ch);
        } catch {
          /* ignore */
        } finally {
          URL.revokeObjectURL(url);
          resolve();
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });
  } catch {
    /* keep media/background composite */
  }

  try {
    return canvas.toDataURL('image/jpeg', 0.78);
  } catch {
    return null;
  }
}

/** Fast viewport paint — no foreignObject (avoids blank/hanging mirrors). */
function paintViewportCanvas(
  root: Element,
  width: number,
  height: number,
  opts?: { fullUi?: boolean; maxEdge?: number },
): { canvas: HTMLCanvasElement; scale: number; rootRect: DOMRect } | null {
  const maxEdge = opts?.maxEdge ?? VIEWPORT_MAX_EDGE;
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  const cw = Math.max(1, Math.round(width * scale));
  const ch = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) return null;

  const rootRect = root.getBoundingClientRect();
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const rootBg = getComputedStyle(root).backgroundColor;
  ctx.fillStyle = !isTransparentColor(rootBg) ? rootBg : !isTransparentColor(bodyBg) ? bodyBg : '#0b1020';
  ctx.fillRect(0, 0, cw, ch);

  if (opts?.fullUi !== false) {
    paintApproxDom(root, ctx, rootRect, scale, { left: MAX_PAINT_NODES });
  }
  drawMediaLayer(root, ctx, scale);
  return { canvas, scale, rootRect };
}

function rasterizeViewport(root: Element, width: number, height: number): string | null {
  const painted = paintViewportCanvas(root, width, height, { fullUi: true });
  if (!painted) return null;
  try {
    return painted.canvas.toDataURL('image/jpeg', 0.62);
  } catch {
    return null;
  }
}

export type ViewportBitmapFrame = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  originTop: number;
  originLeft: number;
  at: string;
};

/** rAF-friendly transferable frame for zero-lag Inspect mirror. */
export async function captureViewportBitmap(fullUi = true): Promise<ViewportBitmapFrame | null> {
  const root =
    (document.querySelector('[data-admin-embed-app]') as HTMLElement | null) ||
    document.getElementById('root') ||
    document.body;
  if (!root) return null;

  const rect = root.getBoundingClientRect();
  const width = Math.max(1, Math.round(Math.min(rect.width || window.innerWidth, window.innerWidth)));
  const height = Math.max(1, Math.round(Math.min(rect.height || window.innerHeight, window.innerHeight)));
  if (width < 8 || height < 8) return null;

  const painted = paintViewportCanvas(root, width, height, { fullUi, maxEdge: 520 });
  if (!painted) return null;

  try {
    const bitmap = await createImageBitmap(painted.canvas);
    return {
      bitmap,
      width,
      height,
      originTop: rect.top,
      originLeft: rect.left,
      at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function capturePickPreview(el: Element, pick: AdminUiPickSelection): Promise<AdminUiPickSnapshot | null> {
  const rect = el.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (width < 2 && height < 2) return null;

  const html = serializeHtml(el, width, height);
  const dataUrl = await rasterizeSelection(el, width, height);

  return {
    label: pick.label,
    tagName: pick.tagName,
    width,
    height,
    html,
    dataUrl,
    at: new Date().toISOString(),
    nodeId: pick.nodeId,
    componentId: pick.componentId,
    resourceId: pick.resourceId,
    mode: 'selection',
    kind: pick.kind ?? null,
  };
}

/** Full live-canvas frame for the Inspect real-time mirror. */
export async function captureViewportPreview(): Promise<AdminUiPickSnapshot | null> {
  const root =
    (document.querySelector('[data-admin-embed-app]') as HTMLElement | null) ||
    document.getElementById('root') ||
    document.body;
  if (!root) return null;

  const rect = root.getBoundingClientRect();
  const width = Math.max(1, Math.round(Math.min(rect.width || window.innerWidth, window.innerWidth)));
  const height = Math.max(1, Math.round(Math.min(rect.height || window.innerHeight, window.innerHeight)));
  if (width < 8 || height < 8) return null;

  const dataUrl = rasterizeViewport(root, width, height);
  if (!dataUrl) return null;

  return {
    label: 'viewport',
    tagName: 'viewport',
    width,
    height,
    dataUrl,
    at: new Date().toISOString(),
    mode: 'viewport',
    originTop: rect.top,
    originLeft: rect.left,
  };
}

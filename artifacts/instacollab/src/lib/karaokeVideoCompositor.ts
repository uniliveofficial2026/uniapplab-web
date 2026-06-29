import {
  estimateSegmentMotionScore,
  nextSegmentTimestamp,
  resetPersonSegmentState,
  segmentDimensions,
  segmentPersonAlpha,
  writeAlphaMaskToImageData,
} from './karaokePersonSegmentation';

export type RgbColor = { r: number; g: number; b: number };

export type CompositorBackgroundSource = HTMLCanvasElement;

export type KaraokeCompositorOptions = {
  beautyFilter: string;
  backgroundImage: CompositorBackgroundSource | null;
  mirror?: boolean;
  backgroundColor?: RgbColor | null;
  segmentTimestampMs?: number;
  /** Run segmentation every frame (picker previews + virtual BG) even when no BG on stage. */
  mattingEnabled?: boolean;
  /** Zero-delay mask — current frame only, no temporal hold or despill. */
  instantMatting?: boolean;
  /**
   * Sharp live preview: keep canvas transparent and let a native-res `<img>` layer show through.
   * Full canvas composite is rendered to the hidden recorder canvas.
   */
  cssBackgroundPreview?: boolean;
  /** Reuse the cutout from an earlier compose call in the same frame. */
  skipMattingUpdate?: boolean;
};

export type KaraokeCompositorScratch = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bgColor: RgbColor | null;
  segmentCanvas: HTMLCanvasElement;
  segmentCtx: CanvasRenderingContext2D;
  maskCanvas: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
  maskImageData: ImageData | null;
  fullMaskCanvas: HTMLCanvasElement;
  fullMaskCtx: CanvasRenderingContext2D;
  personCanvas: HTMLCanvasElement;
  personCtx: CanvasRenderingContext2D;
  /** Masked person at camera resolution — reuse for picker thumbnails. */
  personCutout: HTMLCanvasElement;
  personCutoutCtx: CanvasRenderingContext2D;
  /** Pre-scaled virtual BG at stage resolution — avoids blurry per-frame rescaling. */
  backgroundLayer: HTMLCanvasElement;
  backgroundLayerCtx: CanvasRenderingContext2D;
  backgroundLayerKey: string;
  lastVideoW: number;
  lastVideoH: number;
  segmentTick: number;
};

export function createCompositorScratch(): KaraokeCompositorScratch {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create karaoke video compositor canvas');

  const segmentCanvas = document.createElement('canvas');
  const segmentCtx = segmentCanvas.getContext('2d', { willReadFrequently: true });
  if (!segmentCtx) throw new Error('Could not create segment canvas');

  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!maskCtx) throw new Error('Could not create mask canvas');

  const fullMaskCanvas = document.createElement('canvas');
  const fullMaskCtx = fullMaskCanvas.getContext('2d');
  if (!fullMaskCtx) throw new Error('Could not create full mask canvas');

  const personCanvas = document.createElement('canvas');
  const personCtx = personCanvas.getContext('2d');
  if (!personCtx) throw new Error('Could not create person canvas');

  const personCutout = document.createElement('canvas');
  const personCutoutCtx = personCutout.getContext('2d');
  if (!personCutoutCtx) throw new Error('Could not create person cutout canvas');

  const backgroundLayer = document.createElement('canvas');
  const backgroundLayerCtx = backgroundLayer.getContext('2d');
  if (!backgroundLayerCtx) throw new Error('Could not create background layer canvas');

  return {
    canvas,
    ctx,
    bgColor: null,
    segmentCanvas,
    segmentCtx,
    maskCanvas,
    maskCtx,
    maskImageData: null,
    fullMaskCanvas,
    fullMaskCtx,
    personCanvas,
    personCtx,
    personCutout,
    personCutoutCtx,
    backgroundLayer,
    backgroundLayerCtx,
    backgroundLayerKey: '',
    lastVideoW: 0,
    lastVideoH: 0,
    segmentTick: 0,
  };
}

export function disposeCompositorScratch(scratch: KaraokeCompositorScratch): void {
  scratch.bgColor = null;
  scratch.maskImageData = null;
  scratch.backgroundLayerKey = '';
  scratch.segmentTick = 0;
  scratch.lastVideoW = 0;
  scratch.lastVideoH = 0;
  resetPersonSegmentState();
}

/** Ideal short edge for 4K+ virtual backgrounds (8K uploads look best). */
export const VIRTUAL_BACKGROUND_IDEAL_SHORT_EDGE = 3840;
/** Minimum short edge before we warn about softness. */
export const VIRTUAL_BACKGROUND_MIN_SHORT_EDGE = 1920;

export function backgroundSourceSize(source: CompositorBackgroundSource): { w: number; h: number } {
  return { w: source.width, h: source.height };
}

function backgroundSourceKey(source: CompositorBackgroundSource): string {
  return `canvas|${source.width}x${source.height}`;
}

function paintImageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not paint background image');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** Decode at full native resolution — supports 8K uploads without downscaling. */
export async function decodeBackgroundFile(file: Blob): Promise<HTMLCanvasElement> {
  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, {
        colorSpaceConversion: 'none',
        premultiplyAlpha: 'none',
      });
    } catch {
      bitmap = await createImageBitmap(file);
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('Could not decode background image');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    if (canvas.width < 64 || canvas.height < 64) {
      throw new Error('Image decoded at an unusably small size');
    }
    return canvas;
  } catch {
    return decodeBackgroundFileViaImageElement(file);
  }
}

function decodeBackgroundFileViaImageElement(file: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'sync';
    const finish = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = paintImageToCanvas(img);
        if (canvas.width < 64 || canvas.height < 64) {
          reject(new Error('Image decoded at an unusably small size'));
          return;
        }
        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    };
    img.onload = () => {
      void img.decode().then(finish).catch(finish);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode background image'));
    };
    img.src = url;
  });
}

export async function loadCompositorBackground(url: string): Promise<HTMLCanvasElement> {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const response = await fetch(url);
    const blob = await response.blob();
    return decodeBackgroundFile(blob);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'sync';
    img.onload = () => {
      const finish = () => {
        try {
          resolve(paintImageToCanvas(img));
        } catch (err) {
          reject(err);
        }
      };
      void img.decode().then(finish).catch(finish);
    };
    img.onerror = () => reject(new Error(`Failed to load background: ${url}`));
    img.src = url;
  });
}

function sampleRegionAverage(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  regionW: number,
  regionH: number,
): RgbColor {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = y0; y < y0 + regionH; y++) {
    for (let x = x0; x < x0 + regionW; x++) {
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }
  return { r: r / count, g: g / count, b: b / count };
}

function blendColors(a: RgbColor, b: RgbColor, t: number): RgbColor {
  return {
    r: a.r * (1 - t) + b.r * t,
    g: a.g * (1 - t) + b.g * t,
    b: a.b * (1 - t) + b.b * t,
  };
}

export function estimateBackgroundFromEdges(imageData: ImageData): RgbColor {
  const { width, height, data } = imageData;
  const stripY = Math.max(4, Math.floor(height * 0.08));
  const stripX = Math.max(4, Math.floor(width * 0.07));
  const centerMargin = Math.floor(width * 0.2);

  const top = sampleRegionAverage(data, width, centerMargin, 0, width - centerMargin * 2, stripY);
  const left = sampleRegionAverage(data, width, 0, stripY, stripX, height - stripY * 2);
  const right = sampleRegionAverage(
    data,
    width,
    width - stripX,
    stripY,
    stripX,
    height - stripY * 2,
  );

  return {
    r: top.r * 0.45 + left.r * 0.275 + right.r * 0.275,
    g: top.g * 0.45 + left.g * 0.275 + right.g * 0.275,
    b: top.b * 0.45 + left.b * 0.275 + right.b * 0.275,
  };
}

export function averageCornerColor(imageData: ImageData): RgbColor {
  return estimateBackgroundFromEdges(imageData);
}

function backgroundImageSize(image: CompositorBackgroundSource): { w: number; h: number } {
  return backgroundSourceSize(image);
}

/** Cover-fill the destination using the display aspect (not the camera crop). */
function drawCoverBackgroundFill(
  ctx: CanvasRenderingContext2D,
  source: CompositorBackgroundSource,
  destW: number,
  destH: number,
) {
  const { w: imgW, h: imgH } = backgroundImageSize(source);
  if (!imgW || !imgH || !destW || !destH) return;

  const destAspect = destW / destH;
  const imgAspect = imgW / imgH;

  let sx = 0;
  let sy = 0;
  let sw = imgW;
  let sh = imgH;
  if (imgAspect > destAspect) {
    sw = imgH * destAspect;
    sx = (imgW - sw) / 2;
  } else {
    sh = imgW / destAspect;
    sy = (imgH - sh) / 2;
  }

  const prevSmooth = ctx.imageSmoothingEnabled;
  const prevQuality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Downscale large sources (4K/8K) in 2× steps for a sharper result than one jump.
  if (sw > destW * 1.75 || sh > destH * 1.75) {
    let stepCanvas = document.createElement('canvas');
    let cw = sw;
    let ch = sh;
    let stepCtx = stepCanvas.getContext('2d')!;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(source, sx, sy, sw, sh, 0, 0, cw, ch);

    while (cw > destW * 1.75 || ch > destH * 1.75) {
      const nextW = Math.max(destW, Math.floor(cw / 2));
      const nextH = Math.max(destH, Math.floor(ch / 2));
      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = nextW;
      nextCanvas.height = nextH;
      const nextCtx = nextCanvas.getContext('2d')!;
      nextCtx.imageSmoothingEnabled = true;
      nextCtx.imageSmoothingQuality = 'high';
      nextCtx.drawImage(stepCanvas, 0, 0, cw, ch, 0, 0, nextW, nextH);
      stepCanvas = nextCanvas;
      stepCtx = nextCtx;
      cw = nextW;
      ch = nextH;
    }

    ctx.drawImage(stepCanvas, 0, 0, cw, ch, 0, 0, destW, destH);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.imageSmoothingQuality = prevQuality;
    return;
  }

  // Single high-quality blit when downscaling modestly or near 1:1.
  if (sw >= destW * 0.9 && sh >= destH * 0.9) {
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, destW, destH);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.imageSmoothingQuality = prevQuality;
    return;
  }

  // Progressive 2× upscale for small uploads — softer than one large jump.
  let stepCanvas = document.createElement('canvas');
  let cw = Math.max(1, Math.round(sw));
  let ch = Math.max(1, Math.round(sh));
  stepCanvas.width = cw;
  stepCanvas.height = ch;
  let stepCtx = stepCanvas.getContext('2d')!;
  stepCtx.imageSmoothingEnabled = true;
  stepCtx.imageSmoothingQuality = 'high';
  stepCtx.drawImage(source, sx, sy, sw, sh, 0, 0, cw, ch);

  while (cw < destW || ch < destH) {
    const nextW = Math.min(destW, Math.max(cw + 1, cw * 2));
    const nextH = Math.min(destH, Math.max(ch + 1, ch * 2));
    const nextCanvas = document.createElement('canvas');
    nextCanvas.width = nextW;
    nextCanvas.height = nextH;
    const nextCtx = nextCanvas.getContext('2d')!;
    nextCtx.imageSmoothingEnabled = true;
    nextCtx.imageSmoothingQuality = 'high';
    nextCtx.drawImage(stepCanvas, 0, 0, cw, ch, 0, 0, nextW, nextH);
    stepCanvas = nextCanvas;
    stepCtx = nextCtx;
    cw = nextW;
    ch = nextH;
  }

  ctx.drawImage(stepCanvas, 0, 0, cw, ch, 0, 0, destW, destH);
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.imageSmoothingQuality = prevQuality;
}

function ensureBackgroundLayer(
  scratch: KaraokeCompositorScratch,
  source: CompositorBackgroundSource,
  destW: number,
  destH: number,
): void {
  const key = `${backgroundSourceKey(source)}|${destW}x${destH}`;
  if (
    scratch.backgroundLayerKey === key &&
    scratch.backgroundLayer.width === destW &&
    scratch.backgroundLayer.height === destH
  ) {
    return;
  }

  if (scratch.backgroundLayer.width !== destW || scratch.backgroundLayer.height !== destH) {
    scratch.backgroundLayer.width = destW;
    scratch.backgroundLayer.height = destH;
  }

  const layerCtx = scratch.backgroundLayerCtx;
  layerCtx.clearRect(0, 0, destW, destH);
  drawCoverBackgroundFill(layerCtx, source, destW, destH);
  scratch.backgroundLayerKey = key;
}

function drawCoverVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  destW: number,
  destH: number,
  mirror: boolean,
  filter: string,
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const scale = Math.max(destW / vw, destH / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (destW - dw) / 2;
  const dy = (destH - dh) / 2;

  ctx.save();
  ctx.filter = filter;
  if (mirror) {
    ctx.translate(destW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, (destW - dw) / 2, dy, dw, dh);
  } else {
    ctx.drawImage(video, dx, dy, dw, dh);
  }
  ctx.restore();
  ctx.filter = 'none';
}

function drawMirroredVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  destW: number,
  destH: number,
  mirror: boolean,
  filter = 'none',
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  ctx.clearRect(0, 0, destW, destH);
  ctx.save();
  ctx.filter = filter;
  if (mirror) {
    ctx.translate(destW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, destW, destH);
  } else {
    ctx.drawImage(video, 0, 0, destW, destH);
  }
  ctx.restore();
  ctx.filter = 'none';
}

function ensureScratchVideoSize(scratch: KaraokeCompositorScratch, vw: number, vh: number) {
  if (scratch.lastVideoW === vw && scratch.lastVideoH === vh) return;

  scratch.lastVideoW = vw;
  scratch.lastVideoH = vh;
  scratch.canvas.width = vw;
  scratch.canvas.height = vh;
  scratch.personCanvas.width = vw;
  scratch.personCanvas.height = vh;
  scratch.personCutout.width = vw;
  scratch.personCutout.height = vh;
  scratch.fullMaskCanvas.width = vw;
  scratch.fullMaskCanvas.height = vh;

  const { w: sw, h: sh } = segmentDimensions(vw, vh);
  scratch.segmentCanvas.width = sw;
  scratch.segmentCanvas.height = sh;
  scratch.maskCanvas.width = sw;
  scratch.maskCanvas.height = sh;
  scratch.maskImageData = scratch.maskCtx.createImageData(sw, sh);
}

/** Low-res edge sample for matting color model. */
export function sampleMattingBackgroundColor(
  scratch: KaraokeCompositorScratch,
  video: HTMLVideoElement,
  sharedBg: RgbColor | null,
  mirror = true,
  instant = true,
): RgbColor | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return sharedBg;

  const { w: sw, h: sh } = segmentDimensions(vw, vh);
  if (scratch.segmentCanvas.width !== sw || scratch.segmentCanvas.height !== sh) {
    scratch.segmentCanvas.width = sw;
    scratch.segmentCanvas.height = sh;
  }

  drawMirroredVideo(scratch.segmentCtx, video, sw, sh, mirror);
  const imageData = scratch.segmentCtx.getImageData(0, 0, sw, sh);
  const sample = estimateBackgroundFromEdges(imageData);
  if (instant || !sharedBg) return sample;
  return blendColors(sharedBg, sample, 0.18);
}

let beautyFilterScratch: HTMLCanvasElement | null = null;

function applyBeautyPreservingAlpha(
  source: HTMLCanvasElement,
  filter: string,
): HTMLCanvasElement {
  if (!filter || filter === 'none') return source;

  const bw = source.width;
  const bh = source.height;
  if (!bw || !bh) return source;

  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) return source;

  if (!beautyFilterScratch) beautyFilterScratch = document.createElement('canvas');
  if (beautyFilterScratch.width !== bw || beautyFilterScratch.height !== bh) {
    beautyFilterScratch.width = bw;
    beautyFilterScratch.height = bh;
  }
  const beautyCtx = beautyFilterScratch.getContext('2d', { willReadFrequently: true });
  if (!beautyCtx) return source;

  beautyCtx.filter = filter;
  beautyCtx.drawImage(source, 0, 0, bw, bh);
  beautyCtx.filter = 'none';

  const alpha = sourceCtx.getImageData(0, 0, bw, bh).data;
  const filtered = beautyCtx.getImageData(0, 0, bw, bh);
  for (let i = 3; i < filtered.data.length; i += 4) {
    filtered.data[i] = alpha[i];
  }
  beautyCtx.putImageData(filtered, 0, 0);
  return beautyFilterScratch;
}

function despillForegroundCanvas(canvas: HTMLCanvasElement, bg: RgbColor, step = 1) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const { width, height } = canvas;
  if (!width || !height) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const alpha = pixels[i + 3];
      if (alpha < 18) continue;

      let onEdge = alpha < 238;
      if (!onEdge) {
        for (let dy = -1; dy <= 1 && !onEdge; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ni = ((y + dy) * width + (x + dx)) * 4;
            if (pixels[ni + 3] < 128) {
              onEdge = true;
              break;
            }
          }
        }
      }
      if (!onEdge) continue;

      const edgeMix = 1 - Math.abs(alpha - 145) / 145;
      const strength = Math.max(edgeMix, alpha < 250 ? 0.48 : 0.22) * 0.8 * (alpha / 255);
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      pixels[i] = Math.max(0, Math.min(255, r + (r - bg.r) * strength));
      pixels[i + 1] = Math.max(0, Math.min(255, g + (g - bg.g) * strength));
      pixels[i + 2] = Math.max(0, Math.min(255, b + (b - bg.b) * strength));
      const greenSpill = Math.max(0, pixels[i + 1] - Math.max(pixels[i], pixels[i + 2]));
      if (greenSpill > 10) {
        pixels[i + 1] = Math.max(0, pixels[i + 1] - greenSpill * 0.55 * strength);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function upscaleMaskViaCanvas(
  maskCanvas: HTMLCanvasElement,
  srcW: number,
  srcH: number,
  destCtx: CanvasRenderingContext2D,
  destW: number,
  destH: number,
) {
  destCtx.clearRect(0, 0, destW, destH);
  destCtx.imageSmoothingEnabled = true;
  destCtx.imageSmoothingQuality = 'high';
  destCtx.drawImage(maskCanvas, 0, 0, srcW, srcH, 0, 0, destW, destH);
}

function updatePersonCutout(
  scratch: KaraokeCompositorScratch,
  video: HTMLVideoElement,
  mirror: boolean,
  filter: string,
  bgColor: RgbColor | null,
  timestampMs: number,
  instantMatting = true,
): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  ensureScratchVideoSize(scratch, vw, vh);

  const { w: sw, h: sh } = segmentDimensions(vw, vh);

  drawMirroredVideo(scratch.segmentCtx, video, sw, sh, mirror);
  const segmentData = scratch.segmentCtx.getImageData(0, 0, sw, sh);
  const edgeBg = estimateBackgroundFromEdges(segmentData);
  let avgLum = 0;
  for (let i = 0; i < segmentData.data.length; i += 4) {
    avgLum += 0.299 * segmentData.data[i] + 0.587 * segmentData.data[i + 1] + 0.114 * segmentData.data[i + 2];
  }
  avgLum /= Math.max(1, segmentData.data.length / 4);
  const motionScore = estimateSegmentMotionScore(segmentData.data, sw, sh);
  scratch.segmentTick += 1;

  const bgBlend =
    motionScore < 3.5 ? 0.9 : motionScore < 7 ? 0.5 : instantMatting ? 0.32 : avgLum < 98 ? 0.72 : 0.62;
  const bg = scratch.bgColor ? blendColors(scratch.bgColor, edgeBg, bgBlend) : edgeBg;
  scratch.bgColor = bg;

  const alpha = segmentPersonAlpha(scratch.segmentCanvas, segmentData, bg, timestampMs, {
    instant: instantMatting,
  });

  if (!scratch.maskImageData || scratch.maskImageData.width !== sw || scratch.maskImageData.height !== sh) {
    scratch.maskImageData = scratch.maskCtx.createImageData(sw, sh);
  }
  writeAlphaMaskToImageData(scratch.maskImageData, alpha);
  scratch.maskCtx.putImageData(scratch.maskImageData, 0, 0);

  const filterCss = filter && filter !== 'none' ? filter : 'none';
  drawMirroredVideo(scratch.personCutoutCtx, video, vw, vh, mirror, filterCss);
  upscaleMaskViaCanvas(scratch.maskCanvas, sw, sh, scratch.fullMaskCtx, vw, vh);
  scratch.personCutoutCtx.globalCompositeOperation = 'destination-in';
  scratch.personCutoutCtx.imageSmoothingEnabled = true;
  scratch.personCutoutCtx.drawImage(scratch.fullMaskCanvas, 0, 0);
  scratch.personCutoutCtx.globalCompositeOperation = 'source-over';

  despillForegroundCanvas(scratch.personCutout, bg, 2);

  return true;
}

function drawPersonCover(
  ctx: CanvasRenderingContext2D,
  person: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  destW: number,
  destH: number,
) {
  const scale = Math.max(destW / sourceW, destH / sourceH);
  const dw = sourceW * scale;
  const dh = sourceH * scale;
  const dx = (destW - dw) / 2;
  const dy = (destH - dh) / 2;
  ctx.drawImage(person, dx, dy, dw, dh);
}

export function composeKaraokeVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  destW: number,
  destH: number,
  scratch: KaraokeCompositorScratch,
  options: KaraokeCompositorOptions,
): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || destW <= 0 || destH <= 0) return false;

  const mirror = options.mirror ?? true;
  const filter = options.beautyFilter && options.beautyFilter !== 'none' ? options.beautyFilter : 'none';
  const timestampMs = options.segmentTimestampMs ?? nextSegmentTimestamp();
  const instantMatting = options.instantMatting !== false;

  ctx.clearRect(0, 0, destW, destH);

  const needsMatting = Boolean(options.mattingEnabled || options.backgroundImage);

  if (needsMatting) {
    if (!options.skipMattingUpdate) {
      if (
        !updatePersonCutout(
          scratch,
          video,
          mirror,
          filter,
          options.backgroundColor ?? null,
          timestampMs,
          instantMatting,
        )
      ) {
        return false;
      }
    } else if (scratch.personCutout.width <= 0) {
      return false;
    }

    const useCssBackground = Boolean(options.cssBackgroundPreview && options.backgroundImage);

    if (!useCssBackground) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, destW, destH);

      if (options.backgroundImage) {
        ensureBackgroundLayer(scratch, options.backgroundImage, destW, destH);
        ctx.drawImage(scratch.backgroundLayer, 0, 0, destW, destH);
      } else {
        scratch.backgroundLayerKey = '';
      }
    } else {
      scratch.backgroundLayerKey = '';
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawPersonCover(ctx, scratch.personCutout, vw, vh, destW, destH);
    ctx.imageSmoothingEnabled = false;
    return true;
  }

  drawCoverVideo(ctx, video, destW, destH, mirror, filter);
  return true;
}

export function paintStudioVideoTabPreviews(
  video: HTMLVideoElement,
  scratch: KaraokeCompositorScratch,
  options: {
    activeBeautyFilter: string;
    beautyFilters: Record<string, string>;
    filterPreviewCanvases: Record<string, HTMLCanvasElement | null>;
    noneBgPreviewCanvas: HTMLCanvasElement | null;
  },
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  for (const [name, filter] of Object.entries(options.beautyFilters)) {
    const canvas = options.filterPreviewCanvases[name];
    if (canvas) drawBeautyFilterPreview(canvas, video, filter);
  }

  if (options.noneBgPreviewCanvas) {
    drawCameraCoverPreview(
      options.noneBgPreviewCanvas,
      video,
      options.activeBeautyFilter,
      BG_PREVIEW_SIZE,
    );
  }
}

export function buildCompositorCaptureStream(
  canvas: HTMLCanvasElement,
  cameraStream: MediaStream | null,
  fps = 30,
): MediaStream {
  const stream = canvas.captureStream(fps);
  const audioTrack = cameraStream?.getAudioTracks()[0];
  if (audioTrack) {
    stream.addTrack(audioTrack);
  }
  return stream;
}

const PREVIEW_W = 160;
const PREVIEW_H = 213;
const BG_PREVIEW_SIZE = 216;

export function drawBeautyFilterPreview(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  beautyFilter: string,
): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  if (canvas.width !== PREVIEW_W || canvas.height !== PREVIEW_H) {
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const filter = beautyFilter && beautyFilter !== 'none' ? beautyFilter : 'none';
  const scale = Math.max(PREVIEW_W / vw, PREVIEW_H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dy = (PREVIEW_H - dh) / 2;

  ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
  ctx.save();
  ctx.filter = filter;
  ctx.translate(PREVIEW_W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, (PREVIEW_W - dw) / 2, dy, dw, dh);
  ctx.restore();
  ctx.filter = 'none';
  return true;
}

/** Picker thumbnail — live camera (original room, no virtual background). */
export function drawCameraCoverPreview(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  beautyFilter: string,
  size: number,
): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const filter = beautyFilter && beautyFilter !== 'none' ? beautyFilter : 'none';
  const scale = Math.max(size / vw, size / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dy = (size - dh) / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.filter = filter;
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, (size - dw) / 2, dy, dw, dh);
  ctx.restore();
  ctx.filter = 'none';
  return true;
}

/** Picker thumbnail — person cutout on black (virtual background previews). */
export function drawMattingOnlyPreview(
  canvas: HTMLCanvasElement,
  personCutout: HTMLCanvasElement,
  sourceW: number,
  sourceH: number,
): boolean {
  if (!sourceW || !sourceH || personCutout.width <= 0) return false;

  if (canvas.width !== BG_PREVIEW_SIZE || canvas.height !== BG_PREVIEW_SIZE) {
    canvas.width = BG_PREVIEW_SIZE;
    canvas.height = BG_PREVIEW_SIZE;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, BG_PREVIEW_SIZE, BG_PREVIEW_SIZE);
  ctx.imageSmoothingEnabled = false;
  drawPersonCover(ctx, personCutout, sourceW, sourceH, BG_PREVIEW_SIZE, BG_PREVIEW_SIZE);
  return true;
}

/** Fast picker thumbnail — reuses the main stage cutout, no extra segmentation. */
export function drawVirtualBackgroundPreview(
  canvas: HTMLCanvasElement,
  backgroundImage: CompositorBackgroundSource,
  personCutout: HTMLCanvasElement,
  sourceW: number,
  sourceH: number,
): boolean {
  if (!sourceW || !sourceH || personCutout.width <= 0) return false;
  if (canvas.dataset.bgPreview !== 'true') return false;

  if (canvas.width !== BG_PREVIEW_SIZE || canvas.height !== BG_PREVIEW_SIZE) {
    canvas.width = BG_PREVIEW_SIZE;
    canvas.height = BG_PREVIEW_SIZE;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.clearRect(0, 0, BG_PREVIEW_SIZE, BG_PREVIEW_SIZE);
  drawCoverBackgroundFill(ctx, backgroundImage, BG_PREVIEW_SIZE, BG_PREVIEW_SIZE);
  ctx.imageSmoothingEnabled = false;
  drawPersonCover(ctx, personCutout, sourceW, sourceH, BG_PREVIEW_SIZE, BG_PREVIEW_SIZE);
  return true;
}

export function scheduleVideoCompositorFrame(
  video: HTMLVideoElement,
  callback: () => void,
): number {
  const rvfc = (
    video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number, meta: VideoFrameCallbackMetadata) => void) => number;
    }
  ).requestVideoFrameCallback;

  if (typeof rvfc === 'function') {
    return rvfc.call(video, () => callback());
  }

  return requestAnimationFrame(callback);
}

export function cancelVideoCompositorFrame(
  video: HTMLVideoElement,
  handle: number,
): void {
  const cancelRvfc = (
    video as HTMLVideoElement & {
      cancelVideoFrameCallback?: (id: number) => void;
    }
  ).cancelVideoFrameCallback;

  if (typeof cancelRvfc === 'function') {
    cancelRvfc.call(video, handle);
    return;
  }

  cancelAnimationFrame(handle);
}

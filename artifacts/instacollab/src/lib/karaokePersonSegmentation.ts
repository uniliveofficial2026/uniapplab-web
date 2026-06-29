export type RgbColor = { r: number; g: number; b: number };

type ImageSegmenter = {
  segment?: (
    image: HTMLVideoElement | HTMLCanvasElement,
  ) => {
    confidenceMasks?: Array<{
      width: number;
      height: number;
      getAsFloat32Array: () => Float32Array;
    }>;
  };
  segmentForVideo: (
    video: HTMLVideoElement | HTMLCanvasElement,
    timestamp: number,
  ) => {
    confidenceMasks?: Array<{
      width: number;
      height: number;
      getAsFloat32Array: () => Float32Array;
    }>;
  };
  close: () => void;
};

/** 640px segment + GPU upscale — fast enough for real-time, sharp via canvas scale. */
export const SEGMENT_TARGET_WIDTH = 640;

const SEGMENTER_PIPELINE_VERSION = 15;
let segmenterPipelineVersion = 0;

let segmenter: ImageSegmenter | null = null;
let segmenterInitPromise: Promise<boolean> | null = null;
let segmentTimestampCursor = 0;
let previousAlpha: Uint8ClampedArray | null = null;
let previousAlphaKey = '';
let previousBgFlood: Uint8Array | null = null;
let previousLumaThumb: Float32Array | null = null;
let previousLumaThumbKey = '';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const VISION_MODULE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

export function segmentDimensions(videoW: number, videoH: number): { w: number; h: number } {
  if (!videoW || !videoH) return { w: SEGMENT_TARGET_WIDTH, h: SEGMENT_TARGET_WIDTH };
  const h = Math.max(1, Math.round((SEGMENT_TARGET_WIDTH * videoH) / videoW));
  return { w: SEGMENT_TARGET_WIDTH, h };
}

export function ensurePersonSegmenter(): Promise<boolean> {
  if (segmenter && segmenterPipelineVersion === SEGMENTER_PIPELINE_VERSION) {
    return Promise.resolve(true);
  }
  if (segmenter) {
    closePersonSegmenter();
  }
  if (segmenterInitPromise) return segmenterInitPromise;

  segmenterInitPromise = (async () => {
    try {
      const vision = await import(/* @vite-ignore */ VISION_MODULE_URL);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
      const create = (delegate: 'GPU' | 'CPU') =>
        vision.ImageSegmenter.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate,
          },
          runningMode: 'IMAGE',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        }) as Promise<ImageSegmenter>;

      try {
        segmenter = await create('GPU');
      } catch {
        segmenter = await create('CPU');
      }
      segmenterPipelineVersion = SEGMENTER_PIPELINE_VERSION;
      segmentTimestampCursor = 0;
      return true;
    } catch (err) {
      console.warn('MediaPipe person segmenter unavailable, using flood-fill matting:', err);
      segmenter = null;
      return false;
    }
  })();

  return segmenterInitPromise;
}

export function closePersonSegmenter(): void {
  segmenter?.close();
  segmenter = null;
  segmenterInitPromise = null;
  segmenterPipelineVersion = 0;
  segmentTimestampCursor = 0;
  resetPersonSegmentState();
}

export function resetPersonSegmentState(): void {
  previousAlpha = null;
  previousAlphaKey = '';
  previousBgFlood = null;
  previousLumaThumb = null;
  previousLumaThumbKey = '';
}

export function isPersonSegmenterReady(): boolean {
  return segmenter !== null;
}

export function nextSegmentTimestamp(): number {
  segmentTimestampCursor = Math.max(segmentTimestampCursor + 1, performance.now());
  return segmentTimestampCursor;
}

export type SegmentPersonAlphaOptions = {
  /** Current-frame mask only — no cross-frame hold (live preview / movement). */
  instant?: boolean;
};

/** Downsampled luma diff — 0 means perfectly still, ~15+ means active motion. */
export function estimateSegmentMotionScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const step = 3;
  const tw = Math.max(1, Math.floor(width / step));
  const th = Math.max(1, Math.floor(height / step));
  const key = `${tw}x${th}`;
  const thumb = new Float32Array(tw * th);

  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const x = Math.min(width - 1, tx * step);
      const y = Math.min(height - 1, ty * step);
      const p = (y * width + x) * 4;
      thumb[ty * tw + tx] =
        0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }
  }

  if (!previousLumaThumb || previousLumaThumbKey !== key || previousLumaThumb.length !== thumb.length) {
    previousLumaThumb = thumb;
    previousLumaThumbKey = key;
    return 18;
  }

  let diff = 0;
  for (let i = 0; i < thumb.length; i++) {
    diff += Math.abs(thumb[i] - previousLumaThumb[i]);
  }
  previousLumaThumb = thumb;
  return diff / thumb.length;
}

let lastSegmentMotionScore = 18;
let enhanceScratch: Uint8ClampedArray | null = null;

export function getLastSegmentMotionScore(): number {
  return lastSegmentMotionScore;
}

function frameAverageLuminance(data: Uint8ClampedArray): number {
  let sum = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / Math.max(1, pixels);
}

/** Lift shadows + contrast on a copy for ML only — original pixels stay for color matting. */
function prepareSegmentationInput(
  segmentCanvas: HTMLCanvasElement,
  imageData: ImageData,
): { avgLuminance: number; isLowLight: boolean; isVeryLowLight: boolean } {
  const { width, height, data } = imageData;
  if (!enhanceScratch || enhanceScratch.length !== data.length) {
    enhanceScratch = new Uint8ClampedArray(data.length);
  }
  enhanceScratch.set(data);

  const avgLuminance = frameAverageLuminance(enhanceScratch);
  const isVeryLowLight = avgLuminance < 52;
  const isLowLight = avgLuminance < 98;

  if (isLowLight) {
    const gamma = isVeryLowLight ? 1.82 : 1.48;
    const contrast = isVeryLowLight ? 1.28 : 1.14;
    const lift = isVeryLowLight ? 0.055 : 0.028;

    for (let i = 0; i < enhanceScratch.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = enhanceScratch[i + c] / 255;
        v = Math.pow(Math.max(0, v + lift * (1 - v)), 1 / gamma);
        v = (v - 0.5) * contrast + 0.5;
        enhanceScratch[i + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
    }

    const segCtx = segmentCanvas.getContext('2d', { willReadFrequently: true });
    if (segCtx) {
      const enhancedFrame = new Uint8ClampedArray(enhanceScratch);
      segCtx.putImageData(new ImageData(enhancedFrame, width, height), 0, 0);
    }
  }

  return { avgLuminance, isLowLight, isVeryLowLight };
}

function chromaBiasForLuminance(avgLuminance: number): { yWeight: number; chromaWeight: number } {
  if (avgLuminance < 52) return { yWeight: 0.72, chromaWeight: 2.05 };
  if (avgLuminance < 98) return { yWeight: 1.0, chromaWeight: 1.55 };
  return { yWeight: 1.4, chromaWeight: 1.0 };
}

function colorDistanceYCbCrAdaptive(
  r: number,
  g: number,
  b: number,
  ref: RgbColor,
  avgLuminance: number,
): number {
  const a = rgbToYCbCr(r, g, b);
  const bRef = rgbToYCbCr(ref.r, ref.g, ref.b);
  const { yWeight, chromaWeight } = chromaBiasForLuminance(avgLuminance);
  const dy = a.y - bRef.y;
  const dcb = a.cb - bRef.cb;
  const dcr = a.cr - bRef.cr;
  return Math.sqrt(dy * dy * yWeight + (dcb * dcb + dcr * dcr) * chromaWeight);
}

function floodTolerancesForLuminance(avgLuminance: number): { seed: number; grow: number } {
  if (avgLuminance < 52) return { seed: 50, grow: 68 };
  if (avgLuminance < 98) return { seed: 45, grow: 60 };
  return { seed: 40, grow: 54 };
}

function rgbToYCbCr(r: number, g: number, b: number) {
  return {
    y: 0.299 * r + 0.587 * g + 0.114 * b,
    cb: 128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
    cr: 128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
  };
}

function idx(x: number, y: number, width: number) {
  return y * width + x;
}

function centerProtection(x: number, y: number, width: number, height: number): number {
  const nx = (x / Math.max(1, width - 1) - 0.5) * 2;
  const ny = (y / Math.max(1, height - 1) - 0.5) * 2.2;
  const dist = Math.sqrt(nx * nx + ny * ny);
  return Math.max(0, Math.min(1, 1 - dist));
}

function floodBackgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bg: RgbColor,
  seedTolerance: number,
  growTolerance: number,
  avgLuminance = 128,
): Uint8Array {
  const isBg = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const isSimilar = (pixelIndex: number, tolerance: number) =>
    colorDistanceYCbCrAdaptive(
      data[pixelIndex],
      data[pixelIndex + 1],
      data[pixelIndex + 2],
      bg,
      avgLuminance,
    ) < tolerance;

  const seed = (x: number, y: number) => {
    const i = idx(x, y, width);
    const pi = i * 4;
    if (visited[i] || !isSimilar(pi, seedTolerance)) return;
    if (centerProtection(x, y, width, height) > 0.48) return;
    visited[i] = 1;
    isBg[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = idx(nx, ny, width);
      if (visited[ni]) continue;
      const pi = ni * 4;
      if (!isSimilar(pi, growTolerance)) continue;
      if (centerProtection(nx, ny, width, height) > 0.48) continue;
      visited[ni] = 1;
      isBg[ni] = 1;
      queue.push(ni);
    }
  }

  return isBg;
}

function dilateForeground(alpha: Uint8ClampedArray, width: number, height: number, radius: number) {
  const out = new Uint8ClampedArray(alpha);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (alpha[i] > 20) {
        out[i] = alpha[i];
        continue;
      }
      let maxA = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          maxA = Math.max(maxA, alpha[idx(nx, ny, width)]);
        }
      }
      out[i] = Math.round(maxA * 0.96);
    }
  }
  return out;
}

function erodeForeground(alpha: Uint8ClampedArray, width: number, height: number, radius: number) {
  const out = new Uint8ClampedArray(alpha);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (alpha[i] < 12) {
        out[i] = 0;
        continue;
      }
      let minA = 255;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          minA = Math.min(minA, alpha[idx(nx, ny, width)]);
        }
      }
      out[i] = minA;
    }
  }
  return out;
}

function sampleConfidenceMask(
  mask: Float32Array,
  maskW: number,
  maskH: number,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const fx = (x / Math.max(1, width - 1)) * (maskW - 1);
  const fy = (y / Math.max(1, height - 1)) * (maskH - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(maskW - 1, x0 + 1);
  const y1 = Math.min(maskH - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const v00 = mask[y0 * maskW + x0];
  const v10 = mask[y0 * maskW + x1];
  const v01 = mask[y1 * maskW + x0];
  const v11 = mask[y1 * maskW + x1];
  const top = v00 * (1 - tx) + v10 * tx;
  const bottom = v01 * (1 - tx) + v11 * tx;
  return top * (1 - ty) + bottom * ty;
}

function buildMediaPipeAlphaMask(
  width: number,
  height: number,
  confidence: Float32Array,
  maskW: number,
  maskH: number,
  avgLuminance = 128,
): Uint8ClampedArray {
  const lowBoost = avgLuminance < 98 ? ((98 - avgLuminance) / 98) * 0.12 : 0;
  const alpha = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const conf = sampleConfidenceMask(confidence, maskW, maskH, x, y, width, height);
      const core = centerProtection(x, y, width, height);
      const threshold = (core > 0.42 ? 0.33 : 0.28) - lowBoost;
      const t = Math.max(0, Math.min(1, (conf - 0.005) / Math.max(0.18, threshold)));
      const soft = t * t * (3 - 2 * t);
      alpha[idx(x, y, width)] = Math.round(soft * 255);
    }
  }
  return alpha;
}

/** Person silhouette straight from ML — body parts preserved, room excluded. */
function buildPersonMaskFromMp(mpAlpha: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mpAlpha.length);
  for (let i = 0; i < mpAlpha.length; i++) {
    const mp = mpAlpha[i];
    if (mp >= 108) {
      out[i] = 255;
    } else if (mp >= 58) {
      out[i] = Math.round(200 + ((mp - 58) / 50) * 55);
    } else if (mp >= 38) {
      out[i] = Math.round(((mp - 38) / 20) * 120);
    } else {
      out[i] = 0;
    }
  }
  return out;
}

/** Remove original room pixels — flood + ML, never cuts confident body. */
function cutOriginalRoomBackground(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);

  for (let i = 0; i < alpha.length; i++) {
    const mp = mpAlpha[i];
    const a = alpha[i];

    if (mp >= 88) {
      out[i] = 255;
      continue;
    }

    if (isBgFlood[i] === 1) {
      out[i] = mp >= 46 ? 255 : 0;
      continue;
    }

    if (mp < 38) {
      out[i] = 0;
      continue;
    }

    if (mp >= 74) {
      out[i] = mp >= 105 ? 255 : Math.max(a, mp, 220);
      continue;
    }

    out[i] = a;
  }

  return out;
}

/** Grow flood 1px into uncertain ML edge so room color cannot leak through halo. */
function widenBgFloodAtEdges(
  isBgFlood: Uint8Array,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const out = new Uint8Array(isBgFlood);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width);
      if (isBgFlood[i]) {
        out[i] = 1;
        continue;
      }
      if (mpAlpha[i] >= 44) continue;

      let bgNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (isBgFlood[idx(x + dx, y + dy, width)]) bgNeighbors++;
        }
      }

      if (bgNeighbors >= 4 && mpAlpha[i] < 76) {
        out[i] = 1;
      } else if (bgNeighbors >= 2 && mpAlpha[i] < 48) {
        out[i] = 1;
      }
    }
  }

  return out;
}

/** Color + flood + ML purge — zero room pixels outside the body silhouette. */
function aggressiveRoomPurge(
  data: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  bg: RgbColor,
  fg: RgbColor,
  avgLuminance: number,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);
  const moving = motionScore >= 5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const mp = mpAlpha[i];
      const a = alpha[i];
      const flooded = isBgFlood[i] === 1;
      const hairBand = isHairZone(y, height);

      if (mp >= 96) {
        out[i] = 255;
        continue;
      }

      const p = i * 4;
      const dFg = colorDistanceYCbCrAdaptive(data[p], data[p + 1], data[p + 2], fg, avgLuminance);
      const dBg = colorDistanceYCbCrAdaptive(data[p], data[p + 1], data[p + 2], bg, avgLuminance);
      const roomColored = dBg + 4 < dFg;

      if (hairBand && mp >= 40 && dFg + 12 < dBg && a > 100) {
        out[i] = Math.max(a, 230);
        continue;
      }

      if (flooded && mp < (moving ? 74 : 82)) {
        out[i] = 0;
        continue;
      }

      if (roomColored && mp < (moving ? 58 : 66)) {
        out[i] = 0;
        continue;
      }

      if (a < 195 && flooded && mp < 88) {
        out[i] = 0;
        continue;
      }

      if (mp < 32) {
        out[i] = 0;
        continue;
      }

      if (mp >= 78 && a >= 170) {
        out[i] = 255;
        continue;
      }

      const onContour = isAlphaContourNeighbor(alpha, x, y, width, height);
      if ((flooded || onContour) && a < 235 && mp < 80) {
        out[i] = mp >= (moving ? 58 : 68) && dFg < dBg ? 255 : 0;
        continue;
      }

      out[i] = a;
    }
  }

  return out;
}

/** Hard 0/255 on exterior — kills semi-transparent room halos on the virtual BG. */
function forceBinaryExteriorMask(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  if (motionScore >= 10) return alpha;

  const out = new Uint8ClampedArray(alpha);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const mp = mpAlpha[i];
      const a = alpha[i];
      const flooded = isBgFlood[i] === 1;
      const hairBand = isHairZone(y, height);

      if (mp >= 92) {
        out[i] = 255;
        continue;
      }

      if (flooded && mp < 76) {
        out[i] = 0;
        continue;
      }

      if (mp < 30) {
        out[i] = 0;
        continue;
      }

      let transparentTouch = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (alpha[idx(nx, ny, width)] < 28) transparentTouch++;
        }
      }

      const exterior = flooded || transparentTouch >= 4;
      if (!exterior) {
        out[i] = a >= 248 ? 255 : a;
        continue;
      }

      if (hairBand && mp >= 44 && a > 150) {
        out[i] = a > 200 ? 255 : a;
        continue;
      }

      if (a > 186 && mp >= 64) {
        out[i] = 255;
      } else if (a < 140 || mp < 58) {
        out[i] = 0;
      } else {
        out[i] = mp >= 62 ? 255 : 0;
      }
    }
  }

  return out;
}

function binarizeMask(alpha: Uint8ClampedArray, threshold = 128): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length);
  for (let i = 0; i < alpha.length; i++) {
    out[i] = alpha[i] >= threshold ? 255 : 0;
  }
  return out;
}

function dilateBinary(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (alpha[i] >= 128) {
        out[i] = 255;
        continue;
      }
      let on = false;
      for (let dy = -1; dy <= 1 && !on; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (alpha[idx(nx, ny, width)] >= 128) {
            on = true;
            break;
          }
        }
      }
      out[i] = on ? 255 : 0;
    }
  }
  return out;
}

function erodeBinary(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (alpha[i] < 128) {
        out[i] = 0;
        continue;
      }
      let solid = true;
      for (let dy = -1; dy <= 1 && solid; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (alpha[idx(nx, ny, width)] < 128) {
            solid = false;
            break;
          }
        }
      }
      out[i] = solid ? 255 : 0;
    }
  }
  return out;
}

function morphCloseBinary(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  let cur = alpha;
  for (let r = 0; r < radius; r++) {
    cur = dilateBinary(cur, width, height);
  }
  for (let r = 0; r < radius; r++) {
    cur = erodeBinary(cur, width, height);
  }
  return cur;
}

/**
 * Flood from frame edges through low-ML / flooded pixels only.
 * Gaps between arms & torso are NOT exterior — room cannot leak through them.
 */
function labelExteriorBackground(
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const isExterior = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const dmp = dilateMpMask(mpAlpha, width, height, 2);

  const canSpread = (i: number): boolean => {
    const mp = mpAlpha[i];
    if (dmp[i] >= 68) return false;
    if (mp >= 52) return false;
    if (mp >= 38 && isBgFlood[i] === 0) return false;
    return isBgFlood[i] === 1 || mp < 38;
  };

  const enqueue = (x: number, y: number) => {
    const i = idx(x, y, width);
    if (visited[i] || mpAlpha[i] >= 58 || dmp[i] >= 72) return;
    visited[i] = 1;
    isExterior[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = idx(nx, ny, width);
      if (visited[ni] || !canSpread(ni)) continue;
      visited[ni] = 1;
      isExterior[ni] = 1;
      queue.push(ni);
    }
  }

  return isExterior;
}

/** Person = not exterior. Interior cavities (arm/torso gaps) stay solid. */
function buildSilhouetteFromExterior(
  mpAlpha: Uint8ClampedArray,
  isExterior: Uint8Array,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  const mpCut = motionScore >= 5 ? 30 : 34;
  const out = new Uint8ClampedArray(mpAlpha.length);

  for (let i = 0; i < out.length; i++) {
    const mp = mpAlpha[i];
    if (mp >= 36) {
      out[i] = 255;
      continue;
    }
    if (!isExterior[i]) {
      out[i] = 255;
    } else if (mp >= 84) {
      out[i] = 255;
    } else {
      out[i] = mp >= mpCut ? 255 : 0;
    }
  }

  const closeR = motionScore >= 8 ? 4 : motionScore < 4 ? 5 : 4;
  return morphCloseBinary(out, width, height, closeR);
}

/** Remove room pixels on true exterior only — never punches interior body gaps. */
function peelExteriorOnly(
  alpha: Uint8ClampedArray,
  isExterior: Uint8Array,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);

  for (let i = 0; i < alpha.length; i++) {
    const mp = mpAlpha[i];
    if (mp >= 36) {
      out[i] = 255;
      continue;
    }
    if (!isExterior[i]) {
      out[i] = 255;
      continue;
    }
    if (mp >= 68) {
      out[i] = 255;
    } else if (isBgFlood[i] === 1 || mp < 42) {
      out[i] = 0;
    } else {
      out[i] = alpha[i] >= 170 ? 255 : 0;
    }
  }

  return out;
}

/** Closed ML+mask envelope — bridges arm/torso gaps for hole detection. */
function buildClosedPersonEnvelope(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  const dilR = motionScore >= 7 ? 2 : 2;
  const closeR = motionScore >= 7 ? 3 : 4;
  const dmp = dilateMpMask(mpAlpha, width, height, dilR);
  let env = new Uint8ClampedArray(mpAlpha.length);

  for (let i = 0; i < env.length; i++) {
    env[i] = alpha[i] >= 128 || mpAlpha[i] >= 30 || dmp[i] >= 36 ? 255 : 0;
  }

  return morphCloseBinary(env, width, height, closeR);
}

/** Flood exterior void outside the closed body envelope. */
function floodExteriorOutsideEnvelope(
  envelope: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const exterior = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const push = (i: number) => {
    if (visited[i] || envelope[i] >= 128) return;
    visited[i] = 1;
    exterior[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(idx(x, 0, width));
    push(idx(x, height - 1, width));
  }
  for (let y = 0; y < height; y++) {
    push(idx(0, y, width));
    push(idx(width - 1, y, width));
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y > 0) push(i - width);
    if (y < height - 1) push(i + width);
  }

  return exterior;
}

/**
 * Fill every pocket inside the body envelope (armpits, arm-torso wedges, finger gaps).
 * Exterior room outside the envelope stays transparent.
 */
function fillEnclosedSilhouetteHoles(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  const envelope = buildClosedPersonEnvelope(alpha, mpAlpha, width, height, motionScore);
  const exterior = floodExteriorOutsideEnvelope(envelope, width, height);
  const out = new Uint8ClampedArray(alpha.length);

  for (let i = 0; i < out.length; i++) {
    if (envelope[i] >= 128) {
      out[i] = 255;
    } else if (!exterior[i]) {
      out[i] = 255;
    } else {
      out[i] = alpha[i] >= 128 ? 255 : 0;
    }
  }

  return out;
}

/** Grow cutout to fully wrap ML body — attaches mask to every limb/torso pixel, 0 gaps. */
function attachCutoutToFullBody(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isExterior: Uint8Array,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  const radius = motionScore >= 7 ? 2 : 1;
  const dilatedMp = dilateMpMask(mpAlpha, width, height, radius);
  const out = binarizeMask(alpha);

  for (let i = 0; i < out.length; i++) {
    const mp = mpAlpha[i];
    const dmp = dilatedMp[i];
    if (!isExterior[i]) {
      if (mp >= 20 || dmp >= 24) out[i] = 255;
    } else if (mp >= 52 || dmp >= 48) {
      out[i] = 255;
    }
  }

  const grown = dilateBinary(out, width, height);
  for (let i = 0; i < out.length; i++) {
    if (grown[i] < 128) continue;
    if (!isExterior[i]) {
      out[i] = 255;
    } else if (mpAlpha[i] >= 46 || dilatedMp[i] >= 42) {
      out[i] = 255;
    }
  }

  for (let i = 0; i < out.length; i++) {
    if (!isExterior[i] && (mpAlpha[i] >= 18 || dilatedMp[i] >= 22)) {
      out[i] = 255;
    }
  }

  const hairMaxY = Math.ceil(height * 0.52);
  for (let y = 0; y < hairMaxY; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (mpAlpha[i] >= 16 || dilatedMp[i] >= 20) {
        out[i] = 255;
      }
    }
  }

  return out;
}

/** Force every interior cavity pixel opaque when ML sees body. */
function solidifyInteriorCavities(
  alpha: Uint8ClampedArray,
  isExterior: Uint8Array,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  let out = new Uint8ClampedArray(alpha.length);
  for (let i = 0; i < alpha.length; i++) {
    if (!isExterior[i]) {
      out[i] = 255;
    } else {
      out[i] = alpha[i] >= 128 ? 255 : 0;
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    const next = new Uint8ClampedArray(out);
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const i = idx(x, y, width);
        if (isExterior[i] || out[i] >= 128) {
          next[i] = out[i] >= 128 ? 255 : 0;
          continue;
        }

        let solidNeighbors = 0;
        let mpNeighbors = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ni = idx(x + dx, y + dy, width);
            if (out[ni] >= 128) solidNeighbors++;
            if (mpAlpha[ni] >= 48) mpNeighbors++;
          }
        }

        if (solidNeighbors >= 8 || mpNeighbors >= 5 || mpAlpha[i] >= 18) {
          next[i] = 255;
        }
      }
    }
    out = next;
  }

  return out;
}

/** ML wins over flood — stops arm/torso wedges being marked as room. */
function protectPersonFromFlood(
  isBgFlood: Uint8Array,
  mpAlpha: Uint8ClampedArray,
): Uint8Array {
  const out = new Uint8Array(isBgFlood);
  for (let i = 0; i < out.length; i++) {
    if (mpAlpha[i] >= 32) out[i] = 0;
  }
  return out;
}

/** MediaPipe core is sacred — nothing may zero these pixels. */
function enforceMediaPipeCore(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  threshold = 34,
): Uint8ClampedArray {
  const out = binarizeMask(alpha);
  for (let i = 0; i < out.length; i++) {
    if (mpAlpha[i] >= threshold) out[i] = 255;
  }
  return out;
}

/** Seal gaps/holes between body parts so room cannot show through the silhouette. */
function sealBodyPartGaps(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  motionScore = 5,
): Uint8ClampedArray {
  let out = fillEnclosedSilhouetteHoles(alpha, mpAlpha, width, height, motionScore);
  out = recoverFullBodyFromMp(out, mpAlpha, width, height);

  for (let pass = 0; pass < 3; pass++) {
    const next = new Uint8ClampedArray(out);
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const i = idx(x, y, width);
        const mp = mpAlpha[i];

        if (mp >= 46) {
          next[i] = 255;
          continue;
        }
        if (out[i] >= 248) {
          next[i] = 255;
          continue;
        }

        let personRing = 0;
        let mpRing = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ni = idx(x + dx, y + dy, width);
            if (out[ni] >= 195 || mpAlpha[ni] >= 68) personRing++;
            if (mpAlpha[ni] >= 50) mpRing++;
          }
        }

        if (mp >= 28 && (personRing >= 8 || mpRing >= 6)) {
          next[i] = 255;
        } else if (mp >= 32 && personRing >= 4) {
          next[i] = 255;
        } else if (personRing >= 14 && mpRing >= 10) {
          next[i] = 255;
        } else {
          next[i] = out[i] >= 200 ? 255 : out[i];
        }
      }
    }
    out = next;
  }

  for (let i = 0; i < out.length; i++) {
    if (mpAlpha[i] >= 38) out[i] = 255;
  }

  return fillEnclosedSilhouetteHoles(out, mpAlpha, width, height, motionScore);
}

/** Temporal stability on binary mask — interior OR fills gaps, exterior AND kills noise. */
function stabilizeBinarySilhouette(
  current: Uint8ClampedArray,
  isExterior: Uint8Array,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  const key = `${width}x${height}`;
  const curBin = binarizeMask(current);

  if (!previousAlpha || previousAlphaKey !== key || previousAlpha.length !== curBin.length) {
    previousAlpha = new Uint8ClampedArray(curBin);
    previousAlphaKey = key;
    return curBin;
  }

  const out = new Uint8ClampedArray(curBin.length);
  const prev = previousAlpha;
  const still = motionScore < 4;
  const fast = motionScore >= 9;

  for (let i = 0; i < curBin.length; i++) {
    const c = curBin[i] >= 128;
    const p = prev[i] >= 128;
    const mp = mpAlpha[i];
    const ext = isExterior[i] === 1;

    if (fast) {
      out[i] = mp >= 42 ? 255 : c ? 255 : 0;
      continue;
    }

    if (!ext) {
      out[i] = c || p || mp >= 14 ? 255 : 0;
      continue;
    }

    if (mp >= 62) {
      out[i] = 255;
    } else if (still) {
      out[i] = c && p ? 255 : 0;
    } else {
      out[i] = c ? 255 : mp >= 56 ? 255 : 0;
    }
  }

  previousAlpha = new Uint8ClampedArray(out);
  return out;
}

/** Peel 1px room-colored ring glued to the silhouette exterior. */
function peelBleedRing(
  alpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);
  out.set(alpha);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width);
      if (alpha[i] < 200) continue;
      if (mpAlpha[i] >= 88) continue;

      let outerTouch = 0;
      let personAround = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = idx(x + dx, y + dy, width);
          if (isBgFlood[ni] === 1 || alpha[ni] < 24) outerTouch++;
          if (alpha[ni] >= 200 || mpAlpha[ni] >= 72) personAround++;
        }
      }

      if (personAround >= 5) continue;

      if (outerTouch >= 3 && mpAlpha[i] < 80) {
        out[i] = 0;
      } else if (outerTouch >= 5 && mpAlpha[i] < 90) {
        out[i] = 0;
      }
    }
  }

  return out;
}

/** Every mask pixel 0 or 255 — zero semi-transparent bleed on virtual BG. */
function snapMaskFullyBinary(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  data: Uint8ClampedArray,
  bg: RgbColor,
  fg: RgbColor,
  avgLuminance: number,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length);
  const moving = motionScore >= 4;
  const fast = motionScore >= 8;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const mp = mpAlpha[i];
      const flooded = isBgFlood[i] === 1;
      const hairBand = isHairZone(y, height);

      if (mp >= 92) {
        out[i] = 255;
        continue;
      }

      const p = i * 4;
      const dFg = colorDistanceYCbCrAdaptive(data[p], data[p + 1], data[p + 2], fg, avgLuminance);
      const dBg = colorDistanceYCbCrAdaptive(data[p], data[p + 1], data[p + 2], bg, avgLuminance);
      const personColored = dFg + 6 < dBg;

      if (flooded) {
        let personEnvelope = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ni = idx(x + dx, y + dy, width);
            if (mpAlpha[ni] >= 52 || alpha[ni] >= 200) personEnvelope++;
          }
        }
        if (mp >= 38 && personEnvelope >= 4) {
          out[i] = 255;
          continue;
        }
        out[i] = mp >= (moving ? 76 : 82) && personColored ? 255 : 0;
        continue;
      }

      if (mp >= (moving ? 60 : 66)) {
        out[i] = 255;
        continue;
      }

      if (mp < 34) {
        out[i] = 0;
        continue;
      }

      if (hairBand && personColored && mp >= (fast ? 36 : 40)) {
        out[i] = 255;
        continue;
      }

      const fgVote = alpha[i] >= (moving ? 108 : 124) && mp >= (moving ? 42 : 48);
      const mpVote = mp >= (moving ? 50 : 54) && personColored;
      out[i] = fgVote || mpVote ? 255 : 0;
    }
  }

  return out;
}

/** Hair / soft edge recovery using local color on the ML uncertain band only. */
function refineHairEdgeWithColor(
  data: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  bg: RgbColor,
  fg: RgbColor,
  avgLuminance: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const mp = mpAlpha[i];
      const a = alpha[i];
      const inHairZone = y < height * 0.46;
      const onContour = isAlphaContourNeighbor(alpha, x, y, width, height);

      if (a >= 252 || mp >= 118) {
        out[i] = 255;
        continue;
      }

      if (!inHairZone && !onContour) {
        let personAround = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (alpha[idx(x + dx, y + dy, width)] >= 200 || mpAlpha[idx(x + dx, y + dy, width)] >= 52) {
              personAround++;
            }
          }
        }
        if (personAround >= 10 || a >= 128 || mp >= 26) {
          out[i] = 255;
        } else {
          out[i] = a >= 128 ? 255 : 0;
        }
        continue;
      }

      if (mp < 32 || a <= 4) {
        out[i] = a >= 128 ? 255 : 0;
        continue;
      }

      const p = i * 4;
      const dFg = colorDistanceYCbCrAdaptive(data[p], data[p + 1], data[p + 2], fg, avgLuminance);
      const dBg = colorDistanceYCbCrAdaptive(data[p], data[p + 1], data[p + 2], bg, avgLuminance);
      const colorAlpha = Math.round((255 * dBg) / (dFg + dBg + 5));

      if (mp >= 88) {
        out[i] = Math.max(a, colorAlpha, 245);
      } else if (dFg < dBg && mp >= 42) {
        out[i] = Math.max(a, colorAlpha, mp, 200);
      } else if (dFg + 4 < dBg && mp >= 34) {
        out[i] = Math.max(a, colorAlpha);
      } else if (dBg < dFg && mp < 58 && onContour) {
        out[i] = 0;
      } else if (dBg + 2 < dFg && mp < 68 && onContour) {
        out[i] = Math.min(a, Math.round(colorAlpha * 0.25));
      } else {
        out[i] = Math.max(a, Math.round(colorAlpha * 0.65));
      }
    }
  }

  return out;
}

/** Fill body interior and force every ML-person pixel fully opaque. */
function solidifyBodyFromMp(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  let out = closeInteriorHoles(alpha, width, height);
  out = protectInteriorForeground(out, width, height);

  for (let i = 0; i < out.length; i++) {
    if (mpAlpha[i] >= 78) {
      out[i] = 255;
    }
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width);
      if (out[i] >= 250 || mpAlpha[i] < 50) continue;

      let mpNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (mpAlpha[idx(x + dx, y + dy, width)] > 100) mpNeighbors++;
        }
      }
      if (mpNeighbors >= 4) {
        out[i] = 255;
      }
    }
  }

  return out;
}

function isHairZone(y: number, height: number): boolean {
  return y < height * 0.46;
}

function dilateMpMask(
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mpAlpha);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      let maxMp = mpAlpha[i];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          maxMp = Math.max(maxMp, mpAlpha[idx(nx, ny, width)]);
        }
      }
      out[i] = maxMp;
    }
  }
  return out;
}

/** Restore arms/hands during movement before tight snap clips them. */
function recoverMovingLimbs(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  if (motionScore < 2) return alpha;

  const fast = motionScore >= 7;
  const mpUse = fast ? dilateMpMask(mpAlpha, width, height, 1) : mpAlpha;
  const out = new Uint8ClampedArray(alpha);
  out.set(alpha);

  for (let i = 0; i < alpha.length; i++) {
    const mp = mpUse[i];
    const rawMp = mpAlpha[i];
    if (mp >= 115 || rawMp >= 110) {
      out[i] = 255;
    } else if (mp >= 66 || rawMp >= 62) {
      out[i] = Math.max(alpha[i], mp, rawMp, fast ? 252 : 248);
    } else if (mp >= 42 || rawMp >= 40) {
      out[i] = Math.max(alpha[i], mp, rawMp, fast ? 225 : 0);
    } else if (fast && (mp >= 32 || rawMp >= 30)) {
      out[i] = Math.max(alpha[i], Math.round(Math.max(mp, rawMp) * 1.08));
    }
  }

  return out;
}

/** Post-tight hair strand recovery — color matting on head band after binary snap. */
function recoverHairStrands(
  data: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  width: number,
  height: number,
  bg: RgbColor,
  fg: RgbColor,
  avgLuminance: number,
  motionScore: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);
  out.set(alpha);
  const fast = motionScore >= 8;
  const hairMaxY = Math.ceil(height * 0.48);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const mp = mpAlpha[i];
      const a = alpha[i];
      const inHairZone = y < hairMaxY;
      const onContour = isAlphaContourNeighbor(alpha, x, y, width, height);

      if (!inHairZone && !onContour) continue;
      if (mp < 26) continue;
      if (mp >= 112 && a >= 248) continue;
      if (isBgFlood[i] === 1 && mp < 52) continue;

      const p = i * 4;
      const dFg = colorDistanceYCbCrAdaptive(data[p], data[p + 1], data[p + 2], fg, avgLuminance);
      const dBg = colorDistanceYCbCrAdaptive(data[p], data[p + 1], data[p + 2], bg, avgLuminance);
      const colorAlpha = Math.round((255 * dBg) / (dFg + dBg + 4));
      const hairLike = dFg + (fast ? 14 : 10) < dBg;

      if (!hairLike && mp < 55) continue;

      if (inHairZone && hairLike && mp >= 38) {
        if (mp >= (fast ? 42 : 46)) {
          out[i] = 255;
        }
        continue;
      }

      if (onContour && hairLike && mp >= 44) {
        out[i] = mp >= (fast ? 46 : 50) ? 255 : out[i];
      }
    }
  }

  return out;
}

/** Shave 1px room halo on exterior when frame is stable. */
function microShrinkExterior(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);
  out.set(alpha);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width);
      if (alpha[i] < 8) {
        out[i] = 0;
        continue;
      }
      if (isHairZone(y, height) && mpAlpha[i] >= 38) continue;
      if (mpAlpha[i] >= 82) continue;

      if (isBgFlood[i] === 1) {
        out[i] = mpAlpha[i] >= 72 ? alpha[i] : 0;
        continue;
      }

      let bgTouch = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = idx(x + dx, y + dy, width);
          if (isBgFlood[ni] === 1 || alpha[ni] < 20) bgTouch++;
        }
      }
      if (bgTouch >= 3 && mpAlpha[i] < 72) {
        out[i] = 0;
      }
    }
  }

  return out;
}

/** Final binary-tight cutout on the contour — 0 gap, original room fully gone. */
function finalizeTightBodyCutout(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  const moving = motionScore >= 4;
  const fast = motionScore >= 8;
  const contourFg = fast ? 38 : moving ? 48 : 68;
  const out = new Uint8ClampedArray(alpha.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const mp = mpAlpha[i];
      const a = alpha[i];
      const onContour = isAlphaContourNeighbor(alpha, x, y, width, height);
      const hairBand = isHairZone(y, height);

      if (mp >= 108) {
        out[i] = 255;
        continue;
      }

      if (mp < 28 || (isBgFlood[i] === 1 && mp < (fast ? 48 : 54))) {
        out[i] = 0;
        continue;
      }

      if (!onContour) {
        out[i] = mp >= (moving ? 52 : 64) ? 255 : a > 215 ? 255 : a < 15 ? 0 : a;
        continue;
      }

      if (hairBand && mp >= 34 && a > 90) {
        out[i] = mp >= (fast ? 38 : 50) ? 255 : a;
        continue;
      }

      if (mp >= contourFg) {
        out[i] = 255;
      } else if (fast && mp >= 32 && a > 140) {
        out[i] = a;
      } else {
        out[i] = 0;
      }
    }
  }

  return out;
}

/** Extra-tight contour snap — shaves halo/gap outside the ML boundary. */
function ultraTightCutout(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  width: number,
  height: number,
  motionScore: number,
): Uint8ClampedArray {
  if (motionScore >= 5) return alpha;

  const out = new Uint8ClampedArray(alpha);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const mp = mpAlpha[i];
      const a = alpha[i];
      const hairBand = isHairZone(y, height);

      if (mp >= 94) {
        out[i] = 255;
        continue;
      }

      if (mp < 38 || (isBgFlood[i] === 1 && mp < 60)) {
        out[i] = 0;
        continue;
      }

      const onContour = isAlphaContourNeighbor(alpha, x, y, width, height);
      if (onContour) {
        if (hairBand && mp >= 36 && a > 80) {
          out[i] = mp >= 50 ? 255 : a;
        } else {
          out[i] = mp >= 64 ? 255 : 0;
        }
        continue;
      }

      out[i] = mp >= 60 ? 255 : a > 220 ? 255 : a < 10 ? 0 : a;
    }
  }

  return out;
}

/** Motion-gated stability — still = tight+smooth, moving = instant limbs + anti-flicker. */
function stabilizeMaskMotionGated(
  current: Uint8ClampedArray,
  width: number,
  height: number,
  motionScore: number,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
): Uint8ClampedArray {
  const key = `${width}x${height}`;
  if (!previousAlpha || previousAlphaKey !== key || previousAlpha.length !== current.length) {
    previousAlpha = new Uint8ClampedArray(current);
    previousAlphaKey = key;
    return current;
  }

  if (motionScore >= 11) {
    previousAlpha = new Uint8ClampedArray(current);
    return current;
  }

  const still = motionScore < 3.5;
  const moving = motionScore >= 4;
  const fast = motionScore >= 8;
  const active = motionScore >= 6;

  const out = new Uint8ClampedArray(current.length);
  const prev = previousAlpha;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const c = current[i];
      const p = prev[i];
      const mp = mpAlpha[i];
      const onContour = isAlphaContourNeighbor(current, x, y, width, height);

      if (mp >= 118) {
        out[i] = 255;
        continue;
      }
      if (mp < 28 && (isBgFlood[i] === 1 || mp < 18)) {
        out[i] = 0;
        continue;
      }

      if (fast && onContour) {
        out[i] = mp >= 36 ? 255 : c < 28 ? 0 : mp >= 28 ? Math.max(c, mp) : 0;
        continue;
      }

      if (active && onContour) {
        out[i] = mp >= 42 ? 255 : c < 35 ? 0 : c > 210 ? 255 : mp >= 34 ? Math.max(c, 200) : 0;
        continue;
      }

      if (moving && onContour) {
        out[i] = mp >= 40 ? 255 : c < 40 ? 0 : c;
        continue;
      }

      const blend = still ? 0.1 : moving ? 0.55 : 0.35;
      const mixed = Math.round(c * blend + p * (1 - blend));

      if (mp >= 96) {
        out[i] = 255;
      } else if (mp < 32) {
        out[i] = 0;
      } else if (mp >= 62) {
        out[i] = 255;
      } else if (still) {
        out[i] = mixed > 198 ? 255 : mixed < 52 ? 0 : mixed;
      } else if (mixed > 215 || (mp >= 55 && mixed > 110)) {
        out[i] = 255;
      } else if (mixed < 42) {
        out[i] = 0;
      } else {
        out[i] = mixed;
      }

      if (still && !onContour && c < 55 && p > 215) {
        out[i] = 255;
      }
    }
  }

  previousAlpha = new Uint8ClampedArray(out);
  for (let i = 0; i < out.length; i++) {
    out[i] = out[i] >= 120 ? 255 : out[i] <= 36 ? 0 : out[i];
  }
  return out;
}

function buildFloodBackgroundMask(
  imageData: ImageData,
  bg: RgbColor,
  avgLuminance: number,
  instant: boolean,
  motionScore: number,
): Uint8Array {
  const { width, height, data } = imageData;
  const { seed, grow } = floodTolerancesForLuminance(avgLuminance);
  const current = floodBackgroundMask(data, width, height, bg, seed, grow, avgLuminance);
  if (instant && motionScore >= 10) return current;
  return stabilizeBgFloodTemporal(current, width, height, motionScore);
}

function stabilizeBgFloodTemporal(
  current: Uint8Array,
  width: number,
  height: number,
  motionScore: number,
): Uint8Array {
  const key = `${width}x${height}`;
  if (
    !previousBgFlood ||
    previousBgFlood.length !== current.length ||
    motionScore > 18
  ) {
    previousBgFlood = new Uint8Array(current);
    return current;
  }

  const out = new Uint8Array(current.length);
  const prev = previousBgFlood;
  const holdBg = motionScore < 7;

  for (let i = 0; i < current.length; i++) {
    if (current[i] && prev[i]) {
      out[i] = 1;
    } else if (!current[i] && !prev[i]) {
      out[i] = 0;
    } else if (prev[i] && !current[i]) {
      out[i] = holdBg ? 1 : 0;
    } else {
      out[i] = current[i];
    }
  }

  previousBgFlood = new Uint8Array(out);
  return out;
}

function estimateForegroundColor(
  data: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
): RgbColor {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const a = alpha[i];
      if (a < 175) continue;
      const core = centerProtection(x, y, width, height);
      const w = (a / 255) * (0.35 + core * 0.65);
      const p = i * 4;
      r += data[p] * w;
      g += data[p + 1] * w;
      b += data[p + 2] * w;
      weight += w;
    }
  }

  if (weight < 1) return { r: 128, g: 128, b: 128 };
  return { r: r / weight, g: g / weight, b: b / weight };
}

/** Color-model matting on edge/hair pixels — recovers fine detail MediaPipe softens. */
function refineAlphaWithColorModel(
  data: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  bg: RgbColor,
  fg: RgbColor,
  avgLuminance: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);
  const isLowLight = avgLuminance < 98;
  const colorBoost = isLowLight ? 0.14 + ((98 - avgLuminance) / 98) * 0.22 : 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const a = alpha[i];

      if (a >= 252) {
        out[i] = 255;
        continue;
      }
      if (a <= 4) {
        out[i] = 0;
        continue;
      }

      const p = i * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const dFg = colorDistanceYCbCrAdaptive(r, g, b, fg, avgLuminance);
      const dBg = colorDistanceYCbCrAdaptive(r, g, b, bg, avgLuminance);
      const colorAlpha = Math.round((255 * dBg) / (dFg + dBg + 6));

      if (a > 210) {
        out[i] = Math.max(a, colorAlpha);
        continue;
      }

      if (a < 45 && dBg < dFg * (isLowLight ? 0.9 : 0.82) && centerProtection(x, y, width, height) < 0.38) {
        out[i] = Math.min(a, colorAlpha, isLowLight ? 28 : 40);
        continue;
      }

      const uncertainty = 1 - Math.abs(a - 128) / 128;
      const colorWeight = 0.28 + uncertainty * 0.38 + colorBoost;
      const blended = Math.round(a * (1 - colorWeight) + colorAlpha * colorWeight);

      if (dFg + 8 < dBg) {
        out[i] = Math.min(blended, a, Math.round(colorAlpha * (isLowLight ? 0.72 : 0.85)));
      } else if (dFg < dBg) {
        out[i] = Math.max(blended, a, Math.round(colorAlpha * 0.65));
      } else {
        out[i] = Math.min(blended, Math.max(a, colorAlpha));
      }
    }
  }

  return out;
}

/** Fuse ML mask with color flood — MP wins on every confident body pixel (limbs/hands). */
function combineMpAndFloodAlpha(
  mpAlpha: Uint8ClampedArray,
  floodAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  width: number,
  height: number,
  avgLuminance: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mpAlpha.length);
  const lowLight = avgLuminance < 98;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const mp = mpAlpha[i];
      const floodIsPerson = floodAlpha[i] > 128;
      const floodIsBg = isBgFlood[i] === 1;
      const core = centerProtection(x, y, width, height);

      if (mp >= 248) {
        out[i] = 255;
        continue;
      }

      if (mp >= 68) {
        if (mp >= 108) {
          out[i] = 255;
        } else {
          out[i] = Math.max(mp, floodIsBg && core < 0.35 ? mp : 235);
        }
        continue;
      }

      if (mp <= 8 && floodIsBg) {
        out[i] = 0;
        continue;
      }

      if (core > 0.35 && mp >= 48) {
        out[i] = Math.max(mp, 220);
        continue;
      }

      if (floodIsBg || !floodIsPerson) {
        if (mp < (lowLight ? 200 : 185)) {
          out[i] = mp < (lowLight ? 95 : 80) ? 0 : Math.round(mp * 0.08);
        } else {
          out[i] = Math.max(mp, lowLight ? 175 : 165);
        }
        continue;
      }

      out[i] = mp < 120 ? Math.max(mp, lowLight ? 175 : 165) : mp;
    }
  }

  return out;
}

/** Restore fingers, hands, hair strands the flood may have trimmed. */
function recoverFullBodyFromMp(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);

  for (let i = 0; i < alpha.length; i++) {
    const mp = mpAlpha[i];
    const a = alpha[i];
    if (mp >= 125) {
      out[i] = 255;
    } else if (mp >= 78) {
      out[i] = Math.max(a, mp, 230);
    } else if (mp >= 52) {
      out[i] = Math.max(a, Math.round(mp * 1.08), 220);
    } else {
      out[i] = a;
    }
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width);
      if (out[i] >= 200 || mpAlpha[i] < 55) continue;

      let mpStrong = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (mpAlpha[idx(x + dx, y + dy, width)] > 115) mpStrong++;
        }
      }
      if (mpStrong >= 3) {
        out[i] = Math.max(out[i], 245);
      }
    }
  }

  return out;
}

/** Solidify torso/hands/arms during motion — stops background showing through the body. */
function protectInteriorForeground(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width);
      if (alpha[i] >= 235) {
        out[i] = 255;
        continue;
      }

      let strong = 0;
      let soft = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const n = alpha[idx(x + dx, y + dy, width)];
          if (n > 185) strong++;
          if (n > 95) soft++;
        }
      }

      const core = centerProtection(x, y, width, height);
      if (strong >= 8 || (strong >= 5 && core > 0.22)) {
        out[i] = Math.max(alpha[i], 252);
      } else if (soft >= 14 && core > 0.18 && alpha[i] > 40) {
        out[i] = Math.max(alpha[i], 225);
      } else if (soft >= 20 && alpha[i] > 35) {
        out[i] = Math.max(alpha[i], 200);
      }
    }
  }

  return out;
}

/** Fill tiny holes inside the body silhouette (movement flicker). */
function closeInteriorHoles(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const i = idx(x, y, width);
      if (alpha[i] > 145) continue;

      let strong = 0;
      let veryStrong = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const n = alpha[idx(x + dx, y + dy, width)];
          if (n > 210) veryStrong++;
          if (n > 165) strong++;
        }
      }
      if (veryStrong >= 10 || strong >= 16) {
        out[i] = 255;
      } else if (strong >= 10 && alpha[i] < 80) {
        out[i] = Math.max(alpha[i], 235);
      }
    }
  }
  return out;
}

function isAlphaContourNeighbor(
  alpha: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return true;

  let minN = 255;
  let maxN = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const n = alpha[idx(x + dx, y + dy, width)];
      minN = Math.min(minN, n);
      maxN = Math.max(maxN, n);
    }
  }
  return maxN - minN > 78 && minN < 50 && maxN > 165;
}

/** Kill room bleed on exterior — all lighting, edges stay instant. */
function purgeExteriorBleed(
  alpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  mpAlpha: Uint8ClampedArray | null,
  width: number,
  height: number,
  avgLuminance: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);
  const strict = avgLuminance < 98;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const a = alpha[i];
      const core = centerProtection(x, y, width, height);

      if (core > 0.42 || !isBgFlood[i]) {
        out[i] = a;
        continue;
      }

      const mp = mpAlpha ? mpAlpha[i] : 0;
      const mpSaysBg = mp < (strict ? 130 : 118);
      if (mpSaysBg || a < (strict ? 210 : 195)) {
        out[i] = a < (strict ? 120 : 100) ? 0 : 0;
      } else {
        out[i] = Math.round(a * 0.15);
      }
    }
  }

  return out;
}

/** Light edge snap — preserves hair, removes gray fringe (same frame, no lag). */
function refineMatteContour(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  avgLuminance = 128,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const a = alpha[i];

      if (a >= 252) {
        out[i] = 255;
        continue;
      }
      if (a <= 10) {
        out[i] = 0;
        continue;
      }

      let minN = 255;
      let maxN = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const n = alpha[idx(x + dx, y + dy, width)];
          minN = Math.min(minN, n);
          maxN = Math.max(maxN, n);
        }
      }

      const onContour = maxN - minN > 80;
      if (!onContour) {
        out[i] = a;
        continue;
      }

      if (a >= 175) {
        const boost = avgLuminance < 98 ? 1.07 : 1.04;
        const add = avgLuminance < 52 ? 16 : avgLuminance < 98 ? 14 : 12;
        out[i] = Math.min(255, Math.round(a * boost + add));
      } else if (a <= (avgLuminance < 98 ? 85 : 70)) {
        out[i] = 0;
      } else {
        out[i] = a;
      }
    }
  }

  return out;
}

/** Expand person mask 1px where ML sees body — closes edge gap, zero temporal lag. */
function closeEdgeGapFromMp(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width);
      if (alpha[i] >= 250) {
        out[i] = 255;
        continue;
      }
      if (mpAlpha[i] < 62) {
        out[i] = alpha[i];
        continue;
      }

      let solidNeighbor = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = idx(x + dx, y + dy, width);
          if (alpha[ni] > 238 && mpAlpha[ni] > 70) {
            solidNeighbor = true;
            break;
          }
        }
        if (solidNeighbor) break;
      }

      out[i] = solidNeighbor ? 255 : alpha[i] > 200 ? 255 : alpha[i];
    }
  }

  return out;
}

/** Binary snap on contour aligned to ML — tight edge, no halo gap. */
function snapZeroGapEdge(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isBgFlood: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const a = alpha[i];
      const mp = mpAlpha[i];
      const onContour = isAlphaContourNeighbor(alpha, x, y, width, height);

      if (!onContour) {
        out[i] = a > 195 ? 255 : a < 30 ? 0 : a;
        continue;
      }

      if (mp >= 88 || a >= 155) {
        out[i] = 255;
      } else if (mp < 42 && isBgFlood[i] === 1) {
        out[i] = 0;
      } else if (a >= 100) {
        out[i] = 255;
      } else {
        out[i] = 0;
      }
    }
  }

  return out;
}

function stabilizeAlphaTemporal(
  current: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const key = `${width}x${height}`;
  if (!previousAlpha || previousAlphaKey !== key || previousAlpha.length !== current.length) {
    previousAlpha = new Uint8ClampedArray(current);
    previousAlphaKey = key;
    return current;
  }

  const out = new Uint8ClampedArray(current.length);
  const prev = previousAlpha;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const c = current[i];
      const p = prev[i];
      const core = centerProtection(x, y, width, height);

      if (core < 0.42) {
        out[i] = c;
        continue;
      }

      if (c < 12 && p < 12) {
        out[i] = 0;
        continue;
      }

      if (core < 0.18 && c < 85) {
        out[i] = Math.round(c * 0.78 + p * 0.22);
        continue;
      }

      if (p > 150 && c < p - 35) {
        const hold = core > 0.3 ? 0.95 : 0.84;
        out[i] = Math.max(c, Math.round(p * hold));
        continue;
      }

      if (c > 115 || p > 115) {
        const hold = core > 0.35 ? 0.97 : 0.9;
        out[i] = Math.max(c, Math.round(p * hold));
        continue;
      }

      out[i] = c >= p ? c : Math.max(c, Math.round(p * 0.86));
    }
  }

  previousAlpha = new Uint8ClampedArray(out);
  return out;
}

/** Grow hair + shoulder band so dark hair against black BG doesn't leave holes. */
function expandHairAndShoulders(
  alpha: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const hairMax = Math.ceil(height * 0.58);
  const shoulderMin = Math.floor(height * 0.32);
  const shoulderMax = Math.ceil(height * 0.8);
  const out = new Uint8ClampedArray(alpha.length);

  for (let i = 0; i < out.length; i++) {
    if (alpha[i] >= 128 || mpAlpha[i] >= 44) {
      out[i] = 255;
      continue;
    }
    const y = (i / width) | 0;
    if (y < hairMax && mpAlpha[i] >= 24) {
      out[i] = 255;
    } else if (y >= shoulderMin && y <= shoulderMax && mpAlpha[i] >= 28) {
      out[i] = 255;
    } else {
      out[i] = alpha[i] >= 128 ? 255 : 0;
    }
  }

  return morphCloseBinary(out, width, height, 2);
}

/** Zero mask pixels that match the original room (green wall bleed in screenshot). */
function stripRoomColorFromMask(
  alpha: Uint8ClampedArray,
  data: Uint8ClampedArray,
  mpAlpha: Uint8ClampedArray,
  isExterior: Uint8Array,
  isBgFlood: Uint8Array,
  bg: RgbColor,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = binarizeMask(alpha);

  for (let i = 0; i < out.length; i++) {
    if (out[i] < 128) continue;
    const mp = mpAlpha[i];
    if (mp >= 62) continue;

    if (isBgFlood[i] && mp < 66) {
      out[i] = 0;
      continue;
    }

    const p = i * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const dBg = (r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2;
    const greenish = g > r + 5 && g > b + 3;

    if (isExterior[i]) {
      if (mp < 52 && (greenish || dBg < 5800)) out[i] = 0;
    } else if (mp < 34 && greenish && dBg < 7000) {
      out[i] = 0;
    }
  }

  return out;
}

/** Shrink 1–2px exterior ring — removes fat mask blocks beside head/shoulders. */
function shrinkExteriorMaskRing(
  alpha: Uint8ClampedArray,
  isExterior: Uint8Array,
  mpAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  passes = 2,
): Uint8ClampedArray {
  let out = binarizeMask(alpha);

  for (let pass = 0; pass < passes; pass++) {
    const next = new Uint8ClampedArray(out);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = idx(x, y, width);
        if (out[i] < 128) continue;
        if (mpAlpha[i] >= 60) continue;

        let touchesVoid = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (out[idx(x + dx, y + dy, width)] < 128) touchesVoid = true;
          }
        }
        if (!touchesVoid) continue;

        if (isExterior[i] && mpAlpha[i] < 54) {
          next[i] = 0;
        } else if (mpAlpha[i] < 40) {
          next[i] = 0;
        }
      }
    }
    out = next;
  }

  return out;
}

export function writeAlphaMaskToImageData(imageData: ImageData, alphaMask: Uint8ClampedArray) {
  const pixels = imageData.data;
  for (let i = 0, p = 0; i < alphaMask.length; i++, p += 4) {
    pixels[p] = 255;
    pixels[p + 1] = 255;
    pixels[p + 2] = 255;
    pixels[p + 3] = alphaMask[i] >= 64 ? 255 : 0;
  }
}

export function segmentPersonAlpha(
  segmentCanvas: HTMLCanvasElement,
  imageData: ImageData,
  bg: RgbColor | null,
  timestampMs: number,
  options?: SegmentPersonAlphaOptions,
): Uint8ClampedArray {
  const instant = options?.instant !== false;
  const { width, height, data } = imageData;
  const roomBg = bg ?? { r: 128, g: 128, b: 128 };

  if (instant) {
    previousAlpha = null;
    previousAlphaKey = '';
  }

  const { avgLuminance } = prepareSegmentationInput(segmentCanvas, imageData);
  const motionScore = estimateSegmentMotionScore(data, width, height);
  lastSegmentMotionScore = motionScore;
  const isBgFloodRaw = buildFloodBackgroundMask(imageData, roomBg, avgLuminance, instant, motionScore);

  let mpAlpha: Uint8ClampedArray | null = null;
  if (segmenter) {
    try {
      const result = segmenter.segment
        ? segmenter.segment(segmentCanvas)
        : segmenter.segmentForVideo(segmentCanvas, timestampMs);
      const mask = result.confidenceMasks?.[0];
      if (mask) {
        mpAlpha = buildMediaPipeAlphaMask(
          width,
          height,
          mask.getAsFloat32Array(),
          mask.width,
          mask.height,
          avgLuminance,
        );
      }
    } catch (err) {
      console.warn('MediaPipe segment frame failed:', err);
    }
  }

  if (!mpAlpha) {
    const floodAlpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < isBgFloodRaw.length; i++) {
      floodAlpha[i] = isBgFloodRaw[i] ? 0 : 255;
    }
    return floodAlpha;
  }

  const isBgFlood = protectPersonFromFlood(isBgFloodRaw, mpAlpha);
  const isExterior = labelExteriorBackground(mpAlpha, isBgFlood, width, height);

  let refined = buildSilhouetteFromExterior(mpAlpha, isExterior, width, height, motionScore);
  refined = attachCutoutToFullBody(refined, mpAlpha, isExterior, width, height, motionScore);
  refined = morphCloseBinary(binarizeMask(refined), width, height, 2);
  refined = peelExteriorOnly(refined, isExterior, mpAlpha, isBgFlood, width, height);
  refined = stripRoomColorFromMask(refined, data, mpAlpha, isExterior, isBgFlood, roomBg, width, height);
  refined = shrinkExteriorMaskRing(refined, isExterior, mpAlpha, width, height, 2);

  if (!instant) {
    refined = fillEnclosedSilhouetteHoles(refined, mpAlpha, width, height, motionScore);
    refined = sealBodyPartGaps(refined, mpAlpha, width, height, motionScore);
    const fg = estimateForegroundColor(data, refined, width, height);
    refined = binarizeMask(refineHairEdgeWithColor(data, refined, mpAlpha, width, height, roomBg, fg, avgLuminance));
    refined = stabilizeBinarySilhouette(refined, isExterior, mpAlpha, width, height, motionScore);
    return stabilizeAlphaTemporal(enforceMediaPipeCore(refined, mpAlpha, 30), width, height);
  }

  return enforceMediaPipeCore(refined, mpAlpha, 30);
}

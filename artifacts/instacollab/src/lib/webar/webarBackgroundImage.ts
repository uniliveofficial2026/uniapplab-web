import { WEBAR_CAMERA_HEIGHT, WEBAR_CAMERA_WIDTH } from './webarCameraConfig';
import type { TencentBackgroundMediaType } from './webarTypes';

export type TencentBackgroundMedia = {
  url: string;
  type: TencentBackgroundMediaType;
};

const MAX_BG_BYTES = 100 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'avif',
  'ico',
  'heic',
  'heif',
  'tif',
  'tiff',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'm4v',
  'ogg',
  'ogv',
  'mkv',
  'avi',
  '3gp',
  '3g2',
]);

/** Broad accept string for background file picker (images + videos + common extensions). */
export const BACKGROUND_UPLOAD_ACCEPT =
  'image/*,video/*,.svg,.heic,.heif,.mkv,.avi,.3gp,.3g2,.m4v,.ogv';

function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/** Detect image vs video from MIME type or file extension. */
export function detectBackgroundMediaType(file: File): TencentBackgroundMediaType | null {
  const mime = file.type.toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';

  const ext = fileExtension(file.name);
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return null;
}

export function isSupportedBackgroundFile(file: File): boolean {
  return detectBackgroundMediaType(file) !== null;
}

/** Infer TRTC background media type from a URL path. */
export function inferTencentBackgroundType(url: string): TencentBackgroundMediaType {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (/\.(mp4|webm|mov|m4v|ogg|ogv|mkv|avi|3gp|3g2)(\?|$)/.test(path)) return 'video';
  return 'image';
}

/** Resolve TRTC background src + media type for setBackground. */
export function resolveTencentBackgroundSrc(
  url: string,
): { type: TencentBackgroundMediaType; src: string } {
  return { type: inferTencentBackgroundType(url), src: url };
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode background image'));
    img.src = url;
  });
}

async function decodeImageBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    /* SVG / uncommon codecs — rasterize via <img> */
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url);
    const w = Math.max(1, img.naturalWidth || WEBAR_CAMERA_WIDTH);
    const h = Math.max(1, img.naturalHeight || WEBAR_CAMERA_HEIGHT);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not decode background image');
    ctx.drawImage(img, 0, 0, w, h);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Fit user image uploads to the TRTC camera frame (1280×720).
 * Supports JPG, PNG, GIF, WebP, SVG, and other browser-decodable images.
 */
export async function prepareTencentWebARBackgroundUrl(file: Blob): Promise<string> {
  const destW = WEBAR_CAMERA_WIDTH;
  const destH = WEBAR_CAMERA_HEIGHT;

  const bitmap = await decodeImageBitmap(file);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare background image');

    const imgW = bitmap.width;
    const imgH = bitmap.height;
    const destAspect = destW / destH;
    const imgAspect = imgW / imgH;

    let drawW: number;
    let drawH: number;
    let dx: number;
    let dy: number;
    if (imgAspect > destAspect) {
      drawW = destW;
      drawH = destW / imgAspect;
      dx = 0;
      dy = (destH - drawH) / 2;
    } else {
      drawH = destH;
      drawW = destH * imgAspect;
      dx = (destW - drawW) / 2;
      dy = 0;
    }

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, destW, destH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, dx, dy, drawW, drawH);

    // Data URL survives Create Room → Room navigation (blob: URLs are revoked on sheet unmount).
    return canvas.toDataURL('image/jpeg', 0.84);
  } finally {
    bitmap.close();
  }
}

/** Prepare a user-uploaded image or video for TRTC virtual background. */
export async function prepareTencentWebARBackgroundMedia(
  file: File,
): Promise<TencentBackgroundMedia> {
  if (file.size > MAX_BG_BYTES) {
    throw new Error('Background file must be 100 MB or smaller');
  }

  const mediaType = detectBackgroundMediaType(file);
  if (!mediaType) {
    throw new Error(
      'Unsupported file. Use a common image (JPG, PNG, GIF, SVG, WebP…) or video (MP4, WebM, MOV…).',
    );
  }

  if (mediaType === 'video') {
    return { url: URL.createObjectURL(file), type: 'video' };
  }

  return { url: await prepareTencentWebARBackgroundUrl(file), type: 'image' };
}

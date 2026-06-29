import type { LocalGameBundleFile } from './types';

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;

/** Filename keywords ranked best-first for picking a representative cover. */
const COVER_KEYWORDS = [
  'cover',
  'banner',
  'splash',
  'thumbnail',
  'thumb',
  'preview',
  'screenshot',
  'capsule',
  'hero',
  'title',
  'logo',
  'icon',
];

const MAX_COVER_DIMENSION = 720;
const MIN_USEFUL_BYTES = 1024;

function scoreImageFile(file: LocalGameBundleFile): number {
  const name = file.path.toLowerCase();
  let score = 0;
  for (let i = 0; i < COVER_KEYWORDS.length; i++) {
    if (name.includes(COVER_KEYWORDS[i])) {
      score += (COVER_KEYWORDS.length - i) * 1000;
      break;
    }
  }
  // Bigger files tend to be real artwork rather than 16px sprites/favicons.
  score += Math.min(file.data.byteLength / 1024, 800);
  // Penalize deeply nested asset-atlas style paths slightly.
  score -= file.path.split('/').length * 5;
  return score;
}

async function imageFileToDataUrl(file: LocalGameBundleFile): Promise<string | null> {
  const blob = new Blob([new Uint8Array(file.data)], { type: file.mime });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = objectUrl;
    });

    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height || width < 32 || height < 32) return null;

    const scale = Math.min(1, MAX_COVER_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Pick the most representative image in a game bundle and return a downscaled
 * data-URL thumbnail, or null when the bundle has no usable artwork.
 */
export async function extractBundleCover(files: LocalGameBundleFile[]): Promise<string | null> {
  const candidates = files
    .filter((f) => IMAGE_EXTENSIONS.test(f.path) && f.data.byteLength >= MIN_USEFUL_BYTES)
    .sort((a, b) => scoreImageFile(b) - scoreImageFile(a))
    .slice(0, 5);

  for (const candidate of candidates) {
    const dataUrl = await imageFileToDataUrl(candidate);
    if (dataUrl) return dataUrl;
  }
  return null;
}

/** Extract a cover referenced by an inline `<img>`/og:image inside a single HTML file. */
export async function extractHtmlInlineCover(html: string): Promise<string | null> {
  const dataUrlMatch = html.match(
    /<(?:img|meta)[^>]+(?:src|content)=["'](data:image\/[^"']{256,})["']/i
  );
  return dataUrlMatch ? dataUrlMatch[1] : null;
}

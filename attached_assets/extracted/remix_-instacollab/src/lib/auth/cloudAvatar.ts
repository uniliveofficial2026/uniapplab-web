/** Max length for data-URL avatars stored in Supabase `profiles.avatar_url`. */
export const MAX_CLOUD_AVATAR_DATA_URL_CHARS = 350_000;

const MAX_AVATAR_EDGE_PX = 512;
const JPEG_QUALITY_START = 0.85;
const TARGET_MAX_CHARS = 280_000;

function isOversizedDataUrl(url: string): boolean {
  return url.startsWith('data:') && url.length > MAX_CLOUD_AVATAR_DATA_URL_CHARS;
}

export function cloudSafeAvatarUrl(
  avatarUrl: string,
  fallback: string
): {
  url: string;
  trimmedForSize: boolean;
} {
  const trimmed = avatarUrl.trim();
  if (!trimmed) {
    const fb = fallback.trim();
    return {
      url: fb && !isOversizedDataUrl(fb) ? fb : '',
      trimmedForSize: false,
    };
  }
  if (!trimmed.startsWith('data:')) return { url: trimmed, trimmedForSize: false };
  if (!isOversizedDataUrl(trimmed)) return { url: trimmed, trimmedForSize: false };

  const fb = fallback.trim();
  const safeFallback = fb && !isOversizedDataUrl(fb) ? fb : '';
  return { url: safeFallback, trimmedForSize: true };
}

/** Resize/compress uploaded photos so they fit in Supabase text column. */
export function compressAvatarDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:image/')) return Promise.resolve(dataUrl);
  if (dataUrl.length <= 80_000) return Promise.resolve(dataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxSide = Math.max(img.width, img.height, 1);
        const scale = Math.min(1, MAX_AVATAR_EDGE_PX / maxSide);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = JPEG_QUALITY_START;
        let out = canvas.toDataURL('image/jpeg', quality);
        while (out.length > TARGET_MAX_CHARS && quality > 0.45) {
          quality -= 0.1;
          out = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Prepare avatar for cloud profile row (compress uploads, keep https URLs as-is). */
export async function avatarUrlForCloudUpload(
  avatarUrl: string,
  fallback: string
): Promise<{ url: string; trimmedForSize: boolean }> {
  const trimmed = avatarUrl.trim() || fallback.trim();
  if (!trimmed) return { url: '', trimmedForSize: false };

  if (trimmed.startsWith('data:')) {
    const compressed = await compressAvatarDataUrl(trimmed);
    const safe = cloudSafeAvatarUrl(compressed, fallback);
    return {
      url: safe.url,
      trimmedForSize: safe.trimmedForSize || compressed.length < trimmed.length,
    };
  }

  return cloudSafeAvatarUrl(trimmed, fallback);
}

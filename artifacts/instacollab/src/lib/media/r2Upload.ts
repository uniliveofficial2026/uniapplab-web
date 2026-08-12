/**
 * Upload binary media to Cloudflare R2.
 * Prefer Cloudflare Worker (R2 binding) → Supabase Edge Function gateway → Vercel /api/media.
 * Supabase Postgres stores public CDN URLs only — never bytes.
 * Never use Supabase Storage for product media.
 *
 * Prefer `uploadService` from `src/services/UploadService` for new call sites
 * (retry + Zustand status). Existing importers of these helpers remain valid.
 */
import { apiBaseUrl, apiFetch } from '../platformApi';
import { getSupabaseClient } from '../supabase/client';
import { withTimeout, NET_AUTH_MS } from '../networkPolicy';

export type MediaFolder =
  | 'avatars'
  | 'posts'
  | 'chat'
  | 'gifts'
  | 'karaoke'
  | 'covers'
  | 'misc';

export type PresignResponse = {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
  cacheControl?: string;
};

const EDGE_MEDIA_BASE = 'https://ldxrdbyznheayhbkvxlq.supabase.co/functions/v1/media';

let r2ConfiguredCache: boolean | null = null;
let r2ConfiguredCheckedAt = 0;

function mediaWorkerUrl(): string {
  return String(import.meta.env.VITE_MEDIA_WORKER_URL || '')
    .trim()
    .replace(/\/$/, '');
}

/** Ordered media API bases: Worker → Edge Function → Vercel Express. */
function mediaApiBases(): string[] {
  const bases: string[] = [];
  const worker = mediaWorkerUrl();
  if (worker) bases.push(worker);
  bases.push(EDGE_MEDIA_BASE);
  bases.push(`${apiBaseUrl()}/api/media`);
  return bases;
}

async function bearerToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        NET_AUTH_MS,
        'auth.getSession',
      );
      const token = data.session?.access_token;
      if (token) return token;
    } catch {
      /* fall through */
    }
  }
  try {
    const { getFirebaseAuth } = await import('../firebase/app');
    const firebaseUser = getFirebaseAuth()?.currentUser;
    if (firebaseUser) {
      return await withTimeout(firebaseUser.getIdToken(), NET_AUTH_MS, 'firebase.getIdToken');
    }
  } catch {
    /* none */
  }
  return null;
}

async function mediaFetchJson<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.auth !== false) {
    const token = await bearerToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  if (init?.body && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  let lastErr: unknown;
  for (const base of mediaApiBases()) {
    try {
      const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
        ...init,
        headers,
      });
      if (!res.ok) {
        lastErr = new Error(`${res.status} ${await res.text().catch(() => '')}`);
        // Try next base on gateway failures.
        if (res.status >= 500 || res.status === 404) continue;
        throw lastErr;
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('media API unavailable');
}

export async function isR2MediaConfigured(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && r2ConfiguredCache !== null && now - r2ConfiguredCheckedAt < 60_000) {
    return r2ConfiguredCache;
  }
  try {
    const json = await mediaFetchJson<{ r2Configured?: boolean; reachable?: boolean }>(
      '/health',
      { auth: false },
    );
    r2ConfiguredCache = Boolean(json.r2Configured ?? json.reachable ?? true);
    r2ConfiguredCheckedAt = now;
    return r2ConfiguredCache;
  } catch {
    // Fall back to classic Vercel health probe.
    try {
      const res = await fetch(`${apiBaseUrl()}/api/media/health`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        r2ConfiguredCache = false;
        r2ConfiguredCheckedAt = now;
        return false;
      }
      const json = (await res.json()) as { r2Configured?: boolean };
      r2ConfiguredCache = Boolean(json.r2Configured);
      r2ConfiguredCheckedAt = now;
      return r2ConfiguredCache;
    } catch {
      r2ConfiguredCache = false;
      r2ConfiguredCheckedAt = now;
      return false;
    }
  }
}

function guessContentType(blob: Blob, fileName?: string): string {
  if (blob.type) return blob.type;
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'svga') return 'application/octet-stream';
  return 'application/octet-stream';
}

/**
 * Prefer Cloudflare R2. Returns null when media lane is unavailable.
 */
export async function uploadBlobToR2(opts: {
  folder: MediaFolder;
  blob: Blob;
  fileName: string;
  prefix?: string;
}): Promise<string | null> {
  if (!(await isR2MediaConfigured())) return null;

  const contentType = guessContentType(opts.blob, opts.fileName);
  try {
    let presign: PresignResponse;
    try {
      presign = await mediaFetchJson<PresignResponse>('/presign', {
        method: 'POST',
        body: JSON.stringify({
          folder: opts.folder,
          fileName: opts.fileName,
          contentType,
          size: opts.blob.size,
          prefix: opts.prefix,
        }),
      });
    } catch {
      // Legacy Express path
      presign = await apiFetch<PresignResponse>('/api/media/presign', {
        method: 'POST',
        body: JSON.stringify({
          folder: opts.folder,
          fileName: opts.fileName,
          contentType,
          size: opts.blob.size,
          prefix: opts.prefix,
        }),
      });
    }

    const put = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': contentType,
        ...(presign.cacheControl ? { 'cache-control': presign.cacheControl } : {}),
      },
      body: opts.blob,
    });
    if (!put.ok) {
      console.warn('[r2] upload PUT failed', put.status, await put.text().catch(() => ''));
      return null;
    }
    return presign.publicUrl;
  } catch (err) {
    console.warn('[r2] upload failed:', err);
    return null;
  }
}

/** Small data-URL → R2 (avatars). Never persist data: URLs in Postgres. */
export async function uploadDataUrlToR2(opts: {
  folder: MediaFolder;
  dataUrl: string;
  fileName?: string;
  prefix?: string;
}): Promise<string | null> {
  if (!opts.dataUrl.startsWith('data:')) return null;
  if (!(await isR2MediaConfigured())) return null;

  try {
    const res = await fetch(opts.dataUrl);
    const blob = await res.blob();
    const mime = blob.type || 'image/jpeg';
    const ext = mime.includes('png')
      ? 'png'
      : mime.includes('webp')
        ? 'webp'
        : 'jpg';
    return uploadBlobToR2({
      folder: opts.folder,
      blob,
      fileName: opts.fileName || `upload.${ext}`,
      prefix: opts.prefix,
    });
  } catch (err) {
    console.warn('[r2] data-url upload failed:', err);
    return null;
  }
}

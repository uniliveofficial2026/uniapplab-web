/**
 * UploadService — media bytes → Cloudflare R2 only.
 * Postgres stores public URLs. Never uses Supabase Storage.
 * Path: Worker → Edge media gateway → Express fallback (via lib/media/r2Upload).
 */
import {
  isR2MediaConfigured,
  uploadBlobToR2,
  uploadDataUrlToR2,
  type MediaFolder,
} from '../lib/media/r2Upload';
import { useUploadStore } from '../store/uploadStore';
import type { ServiceResult, UploadResult } from '../types/platform';

export type { MediaFolder };

const MAX_UPLOAD_ATTEMPTS = 3;

export interface UploadService {
  isConfigured(): Promise<boolean>;
  uploadBlob(opts: {
    folder: MediaFolder;
    blob: Blob;
    fileName: string;
    prefix?: string;
  }): Promise<ServiceResult<UploadResult>>;
  uploadDataUrl(opts: {
    folder: MediaFolder;
    dataUrl: string;
    fileName?: string;
    prefix?: string;
  }): Promise<ServiceResult<UploadResult>>;
}

async function withRetry<T>(
  fn: () => Promise<T | null>,
  attempts = MAX_UPLOAD_ATTEMPTS,
): Promise<T | null> {
  let last: T | null = null;
  for (let i = 0; i < attempts; i++) {
    last = await fn();
    if (last) return last;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return last;
}

class UploadServiceImpl implements UploadService {
  async isConfigured(): Promise<boolean> {
    return isR2MediaConfigured();
  }

  async uploadBlob(opts: {
    folder: MediaFolder;
    blob: Blob;
    fileName: string;
    prefix?: string;
  }): Promise<ServiceResult<UploadResult>> {
    const store = useUploadStore.getState();
    store.setUploading(true);
    if (!(await isR2MediaConfigured())) {
      store.setResult(null, 'R2 media lane not configured');
      return { ok: false, error: 'r2_not_configured' };
    }
    const publicUrl = await withRetry(() =>
      uploadBlobToR2({
        folder: opts.folder,
        blob: opts.blob,
        fileName: opts.fileName,
        prefix: opts.prefix,
      }),
    );
    if (!publicUrl) {
      store.setResult(null, 'upload_failed');
      return { ok: false, error: 'upload_failed' };
    }
    store.setResult(publicUrl);
    return { ok: true, data: { publicUrl, folder: opts.folder } };
  }

  async uploadDataUrl(opts: {
    folder: MediaFolder;
    dataUrl: string;
    fileName?: string;
    prefix?: string;
  }): Promise<ServiceResult<UploadResult>> {
    const store = useUploadStore.getState();
    store.setUploading(true);
    if (!(await isR2MediaConfigured())) {
      store.setResult(null, 'R2 media lane not configured');
      return { ok: false, error: 'r2_not_configured' };
    }
    const publicUrl = await withRetry(() =>
      uploadDataUrlToR2({
        folder: opts.folder,
        dataUrl: opts.dataUrl,
        fileName: opts.fileName,
        prefix: opts.prefix,
      }),
    );
    if (!publicUrl) {
      store.setResult(null, 'upload_failed');
      return { ok: false, error: 'upload_failed' };
    }
    store.setResult(publicUrl);
    return { ok: true, data: { publicUrl, folder: opts.folder } };
  }
}

export const uploadService: UploadService = new UploadServiceImpl();

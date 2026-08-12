/**
 * Upload / media lane status — non-visual Zustand store.
 */
import { create } from 'zustand';

type UploadState = {
  lastError: string | null;
  lastPublicUrl: string | null;
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
  setResult: (publicUrl: string | null, error?: string | null) => void;
  clear: () => void;
};

export const useUploadStore = create<UploadState>((set) => ({
  lastError: null,
  lastPublicUrl: null,
  uploading: false,
  setUploading: (uploading) => set({ uploading }),
  setResult: (publicUrl, error = null) =>
    set({ lastPublicUrl: publicUrl, lastError: error, uploading: false }),
  clear: () => set({ lastError: null, lastPublicUrl: null, uploading: false }),
}));

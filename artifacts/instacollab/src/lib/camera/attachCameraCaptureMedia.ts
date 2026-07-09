import { processUploadFile } from '../appMediaStore';
import { detectMediaKind } from '../utils';

export type ComposeCameraMediaItem = {
  url: string;
  isVideo: boolean;
  isAudio?: boolean;
  name?: string;
  mimeType?: string;
};

async function blobToFile(blob: Blob, filename: string): Promise<File> {
  return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return blobToFile(blob, filename);
}

/** Persist camera capture for chat compose / uploads (app-media refs, not ephemeral blob URLs). */
export async function attachCameraCaptureMedia(
  payload: { kind: 'photo' | 'video'; url: string; blob?: Blob },
): Promise<ComposeCameraMediaItem> {
  const file =
    payload.kind === 'video' && payload.blob
      ? await blobToFile(payload.blob, 'camera-video.webm')
      : await dataUrlToFile(payload.url, payload.kind === 'video' ? 'camera-video.webm' : 'camera-photo.png');

  const uploaded = await processUploadFile(file);
  const kind = detectMediaKind(file);

  return {
    url: uploaded.url,
    isVideo: kind === 'video',
    isAudio: kind === 'audio',
    name: uploaded.name,
    mimeType: file.type || undefined,
  };
}

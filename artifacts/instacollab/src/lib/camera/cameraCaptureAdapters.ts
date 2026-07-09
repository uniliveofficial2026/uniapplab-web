import type { AppCameraCapturePayload } from '../../contexts/AppCameraContext';

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read camera capture'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read camera capture'));
    reader.readAsDataURL(blob);
  });
}

/** Data URL suitable for avatars, wallpapers, room covers, and inline previews. */
export async function cameraCaptureToDataUrl(
  payload: AppCameraCapturePayload,
): Promise<string> {
  if (payload.kind === 'video' && payload.blob) {
    return blobToDataUrl(payload.blob);
  }
  return payload.url;
}

export type WorkspaceChatCameraAttachment = {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  isImage: boolean;
  isVideo: boolean;
};

/** Google Workspace chat attachment row from a camera capture. */
export async function workspaceChatAttachmentFromCapture(
  payload: AppCameraCapturePayload,
): Promise<WorkspaceChatCameraAttachment> {
  const url = await cameraCaptureToDataUrl(payload);
  const isVideo = payload.kind === 'video';
  const name = isVideo ? 'camera-video.webm' : 'camera-photo.png';
  const mime = isVideo ? payload.blob?.type || 'video/webm' : 'image/png';
  const size = payload.blob?.size ?? Math.max(0, Math.ceil(url.length * 0.75));
  return {
    id: Math.random().toString(36).slice(2, 11),
    url,
    name,
    mime,
    size,
    isImage: !isVideo,
    isVideo,
  };
}

/** File suitable for uploads that expect a `File` (Watch Together, WebAR backgrounds, workspace). */
export async function cameraCaptureToFile(
  payload: AppCameraCapturePayload,
): Promise<File> {
  if (payload.kind === 'video' && payload.blob) {
    const type = payload.blob.type || 'video/webm';
    return new File([payload.blob], 'camera-video.webm', { type });
  }
  const response = await fetch(payload.url);
  const blob = await response.blob();
  const type = blob.type || 'image/png';
  return new File([blob], 'camera-photo.png', { type });
}

export type RoomBackgroundCapture = {
  type: 'image' | 'video';
  value: string;
};

export async function roomBackgroundFromCapture(
  payload: AppCameraCapturePayload,
): Promise<RoomBackgroundCapture> {
  const value = await cameraCaptureToDataUrl(payload);
  return {
    type: payload.kind === 'video' ? 'video' : 'image',
    value,
  };
}

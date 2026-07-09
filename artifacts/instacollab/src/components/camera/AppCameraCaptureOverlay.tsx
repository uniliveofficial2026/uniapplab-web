import React from 'react';
import { ARCameraCapture } from '../ar/ARCameraCapture';
import { DeepARCameraCapture } from '../deepar/DeepARCameraCapture';
import { isFaceARAvailable } from '../../lib/ar/arConfig';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { isTencentWebARConfigured } from '../../lib/webar/webarConfig';

export type AppCameraCapturePayload = {
  kind: 'photo' | 'video';
  url: string;
  blob?: Blob;
};

export type AppCameraCaptureOverlayProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  onCaptured: (payload: AppCameraCapturePayload) => void;
};

/** TRTC / Tencent beauty capture when configured; DeepAR only as fallback. */
export function isAppCameraCaptureAvailable(): boolean {
  return isTencentWebARConfigured() || isFaceARAvailable() || isDeepARConfigured();
}

export function AppCameraCaptureOverlay({
  open,
  onClose,
  title = 'Camera',
  onCaptured,
}: AppCameraCaptureOverlayProps) {
  const tencentCamera = isTencentWebARConfigured();
  const deeparCamera = isDeepARConfigured();
  const useTencentCapture = tencentCamera || isFaceARAvailable();

  return (
    <>
      <ARCameraCapture
        open={open && useTencentCapture}
        onClose={onClose}
        title={title}
        onCaptured={onCaptured}
      />
      <DeepARCameraCapture
        open={open && deeparCamera && !tencentCamera}
        onClose={onClose}
        title={title}
        onCaptured={onCaptured}
      />
    </>
  );
}

import React, { lazy, Suspense } from 'react';
import { isFaceARAvailable } from '../../lib/ar/arConfig';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { isTencentWebARConfigured } from '../../lib/webar/webarConfig';
import {
  isAppCameraCaptureAvailable,
  type AppCameraCapturePayload,
} from './appCameraCaptureTypes';

export type { AppCameraCapturePayload };
export { isAppCameraCaptureAvailable } from './appCameraCaptureTypes';

export type AppCameraCaptureOverlayProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  onCaptured: (payload: AppCameraCapturePayload) => void;
};

const ARCameraCapture = lazy(() =>
  import('../ar/ARCameraCapture').then((m) => ({ default: m.ARCameraCapture })),
);
const DeepARCameraCapture = lazy(() =>
  import('../deepar/DeepARCameraCapture').then((m) => ({ default: m.DeepARCameraCapture })),
);

/** Capture UI — AR SDKs load only when overlay opens. */
export function AppCameraCaptureOverlay({
  open,
  onClose,
  title = 'Camera',
  onCaptured,
}: AppCameraCaptureOverlayProps) {
  if (!open) return null;

  const tencentCamera = isTencentWebARConfigured();
  const deeparCamera = isDeepARConfigured();
  const useTencentCapture = tencentCamera || isFaceARAvailable();

  return (
    <Suspense fallback={null}>
      {useTencentCapture ? (
        <ARCameraCapture open onClose={onClose} title={title} onCaptured={onCaptured} />
      ) : null}
      {deeparCamera && !tencentCamera ? (
        <DeepARCameraCapture open onClose={onClose} title={title} onCaptured={onCaptured} />
      ) : null}
    </Suspense>
  );
}

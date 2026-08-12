/**
 * Camera capture availability + payload types — no AR/DeepAR/WebAR SDK imports.
 */
import { isFaceARAvailable } from '../../lib/ar/arConfig';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { isTencentWebARConfigured } from '../../lib/webar/webarConfig';

export type AppCameraCapturePayload = {
  kind: 'photo' | 'video';
  url: string;
  blob?: Blob;
};

/** TRTC / Tencent beauty capture when configured; DeepAR only as fallback. */
export function isAppCameraCaptureAvailable(): boolean {
  return isTencentWebARConfigured() || isFaceARAvailable() || isDeepARConfigured();
}

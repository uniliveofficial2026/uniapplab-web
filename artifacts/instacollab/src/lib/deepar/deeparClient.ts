/**
 * DeepAR Web SDK client — matches official quickstart import pattern.
 * @see https://github.com/DeepARSDK/quickstart-web-js-npm/blob/main/src/index.js
 */
import * as deepar from 'deepar';
import type { DeepAR, DeepARParams } from 'deepar';

export { deepar };
export const deeparVersion = deepar.version;

export type InitializeDeepARParams = {
  previewElement: HTMLElement;
  licenseKey: string;
  rootPath: string;
  effect?: string;
  /** When true, DeepAR will not open its own camera (use setVideoElement). */
  useExternalVideo?: boolean;
  mirror?: boolean;
  onProgress?: DeepARParams['onProgress'];
};

export function isCameraPermissionError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : '';
  return (
    /NotAllowedError/i.test(message) ||
    /Permission denied/i.test(message) ||
    /permission.*camera/i.test(message)
  );
}

/** Initialize DeepAR per official quickstart (local rootPath + optional effect). */
export async function initializeDeepAR({
  previewElement,
  licenseKey,
  rootPath,
  effect,
  useExternalVideo = false,
  onProgress,
}: InitializeDeepARParams): Promise<DeepAR> {
  return deepar.initialize({
    licenseKey,
    previewElement,
    rootPath,
    ...(effect ? { effect } : {}),
    onProgress,
    additionalOptions: {
      hint: ['faceModelsPredownload', 'faceInit'],
      cameraConfig: useExternalVideo
        ? { disableDefaultCamera: true }
        : {
            facingMode: 'user',
          },
    },
  });
}

/**
 * Shared TRTC camera helpers — one input stream, TRTC-first publish policy.
 */
import { useEffect, useState, type RefObject } from 'react';
import { subscribeAppCamera } from './appCameraOwner';

export function isLiveVideoStream(stream: MediaStream | null | undefined): stream is MediaStream {
  return Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live'));
}

type CameraStreamRefs = {
  stream: MediaStream | null;
  streamRef: RefObject<MediaStream | null>;
};

/** Bind the shared app camera into TRTC without duplicate getUserMedia. */
export function useTrtcCameraInput(
  enabled: boolean,
  camera: CameraStreamRefs,
  facingMode: string,
): MediaStream | null {
  const [inputStream, setInputStream] = useState<MediaStream | null>(null);
  const inputTrackId = inputStream?.getVideoTracks()[0]?.id ?? '';

  useEffect(() => {
    if (!enabled) {
      setInputStream(null);
      return undefined;
    }

    const syncInput = (next?: MediaStream | null) => {
      const candidate = next ?? camera.stream ?? camera.streamRef.current ?? null;
      if (isLiveVideoStream(candidate)) {
        setInputStream(candidate);
      }
    };

    syncInput();
    const unsub = subscribeAppCamera((shared) => {
      if (shared) syncInput(shared);
    }, false);

    return unsub;
  }, [camera.stream, camera.streamRef, enabled, facingMode, inputTrackId]);

  return inputStream;
}

export function resolveCameraReady(camera: {
  ready: boolean;
  stream: MediaStream | null;
  streamRef: RefObject<MediaStream | null>;
}): boolean {
  return Boolean(
    camera.ready ||
      isLiveVideoStream(camera.stream) ||
      isLiveVideoStream(camera.streamRef.current),
  );
}

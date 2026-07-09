import { useCallback, useEffect, useRef, useState } from 'react';
import { attachMediaStreamToVideo } from '../../lib/camera/bindMediaStreamToVideo';
import {
  useCameraStream,
  WEBAR_CAMERA_FRAME_RATE,
  WEBAR_CAMERA_IDEAL,
} from '../../lib/camera/useAppCameraPipeline';

type MultiGuestCameraState = {
  setVideoElement: (element: HTMLVideoElement | null) => void;
  videoTrack: MediaStreamTrack | null;
  active: boolean;
};

/** One camera stream for local preview + LiveKit publish (avoids double getUserMedia). */
export function useMultiGuestCamera(enabled: boolean): MultiGuestCameraState {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [active, setActive] = useState(false);

  const camera = useCameraStream({
    enabled,
    audio: false,
    facingMode: 'user',
    videoIdeal: WEBAR_CAMERA_IDEAL,
    frameRate: WEBAR_CAMERA_FRAME_RATE,
  });

  const bindStreamToVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    attachMediaStreamToVideo(element, camera.streamRef.current, { muted: true });
  }, [camera.streamRef]);

  useEffect(() => {
    if (!enabled || !camera.ready) {
      setVideoTrack(null);
      setActive(false);
      attachMediaStreamToVideo(videoRef.current, null);
      return;
    }
    const stream = camera.streamRef.current;
    const track = stream?.getVideoTracks()[0] ?? null;
    setVideoTrack(track);
    setActive(Boolean(track));
    bindStreamToVideo(videoRef.current);
  }, [bindStreamToVideo, camera.ready, camera.streamRef, enabled]);

  const setVideoElement = useCallback(
    (element: HTMLVideoElement | null) => {
      bindStreamToVideo(element);
    },
    [bindStreamToVideo],
  );

  return { setVideoElement, videoTrack, active };
}

/** @deprecated Use useMultiGuestCamera */
export function useMultiGuestLocalVideo(enabled: boolean) {
  return useMultiGuestCamera(enabled).setVideoElement;
}

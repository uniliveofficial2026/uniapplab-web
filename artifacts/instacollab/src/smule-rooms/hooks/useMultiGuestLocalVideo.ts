import { useCallback, useEffect, useRef, useState } from 'react';

type MultiGuestCameraState = {
  setVideoElement: (element: HTMLVideoElement | null) => void;
  videoTrack: MediaStreamTrack | null;
  active: boolean;
};

/** One camera stream for local preview + LiveKit publish (avoids double getUserMedia). */
export function useMultiGuestCamera(enabled: boolean): MultiGuestCameraState {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [active, setActive] = useState(false);

  const bindStreamToVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    const stream = streamRef.current;
    if (!element || !stream) return;
    if (element.srcObject !== stream) {
      element.srcObject = stream;
    }
    element.muted = true;
    element.playsInline = true;
    void element.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setVideoTrack(null);
      setActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return undefined;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return undefined;
    }

    let cancelled = false;

    void navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
          aspectRatio: { ideal: 1 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] ?? null;
        setVideoTrack(track);
        setActive(Boolean(track));
        bindStreamToVideo(videoRef.current);
      })
      .catch(() => {
        if (!cancelled) {
          setVideoTrack(null);
          setActive(false);
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [bindStreamToVideo, enabled]);

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

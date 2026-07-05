import { useCallback, useEffect, useRef, useState } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { isCameraPermissionError } from '../camera/errors';
import { getEffectProfile } from './effectProfiles';
import { smoothLandmarks } from './faceGeometry';
import {
  detectFaceLandmarks,
  detectPose,
  detectSelfieMask,
  getSmileScore,
  loadMediaPipeVision,
  type MediaPipeVisionBundle,
} from './mediapipeClient';
import { FaceARRenderer } from './three/FaceARRenderer';

const FACE_DETECT_INTERVAL_MS = 1000 / 24;
const SEGMENT_DETECT_INTERVAL_MS = 1000 / 12;

export type UseFaceAROptions = {
  previewRef: React.RefObject<HTMLElement | null>;
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  /** Mount renderer + render loop (when a filter is active). */
  enabled: boolean;
  /** Warm MediaPipe models while the raw camera preview is visible. */
  preload?: boolean;
  initialEffectId?: string;
  mirror?: boolean;
};

export function useFaceAR({
  previewRef,
  videoElementRef,
  enabled,
  preload = false,
  initialEffectId = 'none',
  mirror = true,
}: UseFaceAROptions) {
  const faceRendererRef = useRef<FaceARRenderer | null>(null);
  const visionRef = useRef<MediaPipeVisionBundle | null>(null);
  const lastLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const lastMatrixRef = useRef<Float32Array | number[] | null>(null);
  const lastMaskRef = useRef<{
    mask: Float32Array;
    width: number;
    height: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const mediaPipeTimestampRef = useRef(0);
  const lastFaceDetectAtRef = useRef(0);
  const lastSegmentDetectAtRef = useRef(0);
  const renderingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [activeEffectId, setActiveEffectId] = useState(initialEffectId);

  const activeEffectIdRef = useRef(activeEffectId);
  activeEffectIdRef.current = activeEffectId;

  useEffect(() => {
    setActiveEffectId(initialEffectId);
  }, [initialEffectId]);

  useEffect(() => {
    if (!preload) return;
    let cancelled = false;
    void loadMediaPipeVision((progress) => {
      if (!cancelled && !enabled) setLoadProgress(progress);
    })
      .then((vision) => {
        if (!cancelled) visionRef.current = vision;
      })
      .catch(() => {
        // Ignore preload errors; enabled init will surface them.
      });
    return () => {
      cancelled = true;
    };
  }, [preload, enabled]);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadProgress(0);
      setError(null);
      setPermissionDenied(false);

      try {
        const vision = visionRef.current ?? (await loadMediaPipeVision((progress) => {
          if (!cancelled) setLoadProgress(progress);
        }));
        if (cancelled) return;
        visionRef.current = vision;

        const host = previewRef.current;
        const video = videoElementRef.current;
        if (!host || !video) throw new Error('AR preview area is not ready');

        const renderer = new FaceARRenderer(video, { mirror });
        faceRendererRef.current = renderer;
        host.replaceChildren(renderer.domElement);

        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          if (isCameraPermissionError(err)) {
            setPermissionDenied(true);
            setError('Camera access is required for AR effects.');
          } else {
            setError(err instanceof Error ? err.message : 'Face AR failed to initialize');
          }
          setReady(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      faceRendererRef.current?.dispose();
      faceRendererRef.current = null;
      if (!preload) {
        visionRef.current = null;
      }
      mediaPipeTimestampRef.current = 0;
      lastFaceDetectAtRef.current = 0;
      lastSegmentDetectAtRef.current = 0;
      renderingRef.current = false;
      lastLandmarksRef.current = null;
      lastMatrixRef.current = null;
      lastMaskRef.current = null;
      if (previewRef.current) {
        previewRef.current.replaceChildren();
      }
      setReady(false);
      setLoading(false);
    };
  }, [enabled, preload, previewRef, videoElementRef, mirror]);

  useEffect(() => {
    faceRendererRef.current?.setMirror(mirror);
  }, [mirror]);

  useEffect(() => {
    if (!ready || !enabled) return;

    const video = videoElementRef.current;
    const faceRenderer = faceRendererRef.current;
    const vision = visionRef.current;
    if (!video || !faceRenderer || !vision) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      if (renderingRef.current) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      renderingRef.current = true;
      try {
        const effectId = activeEffectIdRef.current;
        const now = performance.now();
        const profile = getEffectProfile(effectId);

        if (effectId !== 'none' && profile.kind !== 'beauty') {
          if (now - lastFaceDetectAtRef.current >= FACE_DETECT_INTERVAL_MS) {
            lastFaceDetectAtRef.current = now;
            mediaPipeTimestampRef.current += 33;
            const faceResult = detectFaceLandmarks(
              vision.faceLandmarker,
              video,
              mediaPipeTimestampRef.current,
            );
            const raw = faceResult.faceLandmarks[0] ?? null;
            lastLandmarksRef.current = raw
              ? smoothLandmarks(lastLandmarksRef.current, raw, 0.42)
              : null;
            const matrix = faceResult.facialTransformationMatrixes?.[0]?.data ?? null;
            lastMatrixRef.current = matrix ?? null;
            void getSmileScore(faceResult);
          }

          if (
            profile.kind === 'segment-bg' &&
            now - lastSegmentDetectAtRef.current >= SEGMENT_DETECT_INTERVAL_MS
          ) {
            lastSegmentDetectAtRef.current = now;
            mediaPipeTimestampRef.current += 33;
            const segmentResult = detectSelfieMask(
              vision.imageSegmenter,
              video,
              mediaPipeTimestampRef.current,
            );
            const confidenceMask = segmentResult.confidenceMasks?.[0];
            if (confidenceMask) {
              const maskWidth = confidenceMask.width;
              const maskHeight = confidenceMask.height;
              const nextMask = confidenceMask.getAsFloat32Array();
              const prev = lastMaskRef.current;
              if (prev && prev.width === maskWidth && prev.height === maskHeight) {
                prev.mask.set(nextMask);
              } else {
                lastMaskRef.current = {
                  mask: new Float32Array(nextMask),
                  width: maskWidth,
                  height: maskHeight,
                };
              }
            }
          } else if (profile.kind !== 'segment-bg') {
            lastMaskRef.current = null;
          }

          if (profile.usesPose) {
            mediaPipeTimestampRef.current += 33;
            void detectPose(vision.poseLandmarker, video, mediaPipeTimestampRef.current);
          }
        } else {
          lastLandmarksRef.current = null;
          lastMatrixRef.current = null;
          lastMaskRef.current = null;
        }

        const maskData = lastMaskRef.current;
        faceRenderer.renderFrame({
          video,
          effectId,
          landmarks: lastLandmarksRef.current,
          matrix: lastMatrixRef.current,
          mask: maskData?.mask ?? null,
          maskWidth: maskData?.width ?? 0,
          maskHeight: maskData?.height ?? 0,
          timeMs: now,
        });
      } finally {
        renderingRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      renderingRef.current = false;
    };
  }, [ready, enabled, videoElementRef]);

  const switchEffect = useCallback((effectId: string) => {
    setActiveEffectId(effectId);
    activeEffectIdRef.current = effectId;
    lastFaceDetectAtRef.current = 0;
    lastSegmentDetectAtRef.current = 0;
    if (effectId === 'none') {
      lastLandmarksRef.current = null;
      lastMatrixRef.current = null;
      lastMaskRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (activeEffectId === initialEffectId) return;
    switchEffect(initialEffectId);
  }, [initialEffectId, ready, activeEffectId, switchEffect]);

  const takeScreenshot = useCallback(async (): Promise<string | null> => {
    try {
      return faceRendererRef.current?.takeScreenshot() ?? null;
    } catch {
      return null;
    }
  }, []);

  const getCanvasStream = useCallback((fps = 30): MediaStream | null => {
    const canvas = faceRendererRef.current?.domElement;
    if (!canvas) return null;
    return canvas.captureStream(fps);
  }, []);

  const startVideoRecording = useCallback(
    async (recordAudio = true) => {
      const canvasStream = getCanvasStream(30);
      if (!canvasStream) return;

      recorderChunksRef.current = [];
      const tracks = [...canvasStream.getVideoTracks()];
      if (recordAudio) {
        const audioStream = videoElementRef.current?.srcObject;
        if (audioStream instanceof MediaStream) {
          tracks.push(...audioStream.getAudioTracks());
        }
      }

      const recorder = new MediaRecorder(new MediaStream(tracks), {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recorderChunksRef.current.push(event.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    },
    [getCanvasStream, videoElementRef],
  );

  const finishVideoRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const chunks = recorderChunksRef.current;
        resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || 'video/webm' }) : null);
      };
      recorder.stop();
      recorderRef.current = null;
    });
  }, []);

  const getProcessedStream = useCallback(
    async (fps = 30): Promise<MediaStream | null> => {
      const videoStream = getCanvasStream(fps);
      if (!videoStream) return null;
      const audioSource = videoElementRef.current?.srcObject;
      if (audioSource instanceof MediaStream) {
        return new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioSource.getAudioTracks(),
        ]);
      }
      return videoStream;
    },
    [getCanvasStream, videoElementRef],
  );

  return {
    ready,
    loading,
    loadProgress,
    error,
    permissionDenied,
    activeEffectId,
    switchEffect,
    takeScreenshot,
    startVideoRecording,
    finishVideoRecording,
    getCanvasStream,
    getProcessedStream,
    canvasRef: { current: faceRendererRef.current?.domElement ?? null },
  };
}

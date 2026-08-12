import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, SwitchCamera, Video, X } from 'lucide-react';
import { CameraDualBeautyButtons } from '../camera/CameraDualBeautyButtons';
import {
  CameraCaptureViewport,
  CAMERA_CAPTURE_CHROME_CLASS,
  CAMERA_CAPTURE_ROOT_CLASS,
} from '../camera/CameraCaptureViewport';
import { isFaceARAvailable } from '../../lib/ar/arConfig';
import { useFaceAR } from '../../lib/ar/useFaceAR';
import {
  getBeautyVideoFilter,
  type BeautyPresetId,
} from '../../lib/ar/beautyFilters';
import { useStreamBeauty } from '../../lib/ar/useStreamBeauty';
import { EMPTY_BODY_SHAPE, isBodyShapeActive, type BodyShapeParams } from '../../lib/ar/bodyShape';
import {
  getStableCameraIdeal,
  WEBAR_CAMERA_FRAME_RATE,
} from '../../lib/camera/cameraPipelinePolicy';
import {
  captureVideoFrame,
  type CameraFacingMode,
  useCameraStream,
} from '../../lib/camera/useCameraStream';
import {
  nextCameraFacingMode,
  shouldMirrorCameraPreview,
} from '../../lib/camera/cameraMirrorPolicy';
import { useVideoFrameReady } from '../../lib/camera/useVideoFrameReady';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { isTencentWebARConfigured, preloadTencentWebARModule } from '../../lib/webar/useTencentWebAR';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentEffectSelection,
} from '../../lib/webar/webarTypes';
import { LiveBeautySheet } from '../../smule-rooms/components/LiveBeautySheet';
import { ARFilterCarousel } from './ARFilterCarousel';

export type ARCameraCaptureProps = {
  open: boolean;
  onClose: () => void;
  onCaptured: (payload: { kind: 'photo' | 'video'; url: string; blob?: Blob }) => void;
  title?: string;
};

export function ARCameraCapture({ open, onClose, onCaptured }: ARCameraCaptureProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const [faceEffectId, setFaceEffectId] = useState('none');
  const [beautyId, setBeautyId] = useState<BeautyPresetId>('none');
  const [beautyEffects, setBeautyEffects] = useState<TencentEffectSelection>(
    EMPTY_TENCENT_EFFECT_SELECTION,
  );
  const [bodyShape, setBodyShape] = useState<BodyShapeParams>(EMPTY_BODY_SHAPE);
  const [deeparPanelOpen, setDeeparPanelOpen] = useState(false);
  const [beautyPanelOpen, setBeautyPanelOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const rawRecorderRef = useRef<MediaRecorder | null>(null);
  const rawChunksRef = useRef<Blob[]>([]);
  const captureIdealRef = useRef(getStableCameraIdeal(isTencentWebARConfigured()));
  const available = isFaceARAvailable();
  const deeparLicensed = isDeepARConfigured();
  const webarConfigured = isTencentWebARConfigured();
  const faceArActive = faceEffectId !== 'none';
  const beautyEffectsActive = Boolean(
    beautyEffects.makeupId ||
      beautyEffects.stickerId ||
      beautyEffects.filterId ||
      beautyEffects.backgroundUrl ||
      beautyEffects.shapeEffectId,
  );
  const shapeActive = isBodyShapeActive(bodyShape);
  const beautyActive = beautyId !== 'none' || beautyEffectsActive || shapeActive;
  const mirrorPreview = shouldMirrorCameraPreview(facingMode);

  const flipCamera = useCallback(() => {
    if (recording) return;
    setFacingMode((current) => nextCameraFacingMode(current));
  }, [recording]);

  const handleSelectFaceAR = useCallback((effectId: string) => {
    setFaceEffectId(effectId);
    if (effectId !== 'none') {
      setBeautyId('none');
      setBeautyEffects(EMPTY_TENCENT_EFFECT_SELECTION);
    }
  }, []);

  const handleSelectBeauty = useCallback((nextBeautyId: BeautyPresetId) => {
    setBeautyId(nextBeautyId);
    if (nextBeautyId !== 'none') {
      setFaceEffectId('none');
    }
  }, []);

  const handleBeautyEffectsChange = useCallback((effects: TencentEffectSelection) => {
    setBeautyEffects(effects);
    const active = Boolean(
      effects.makeupId || effects.stickerId || effects.filterId || effects.backgroundUrl,
    );
    if (active) setFaceEffectId('none');
  }, []);

  const toggleDeeparPanel = useCallback(() => {
    if (!deeparLicensed || webarConfigured) return;
    setDeeparPanelOpen((open) => {
      const next = !open;
      if (next) setBeautyPanelOpen(false);
      return next;
    });
  }, [deeparLicensed, webarConfigured]);

  const toggleBeautyPanel = useCallback(() => {
    setBeautyPanelOpen((open) => {
      const next = !open;
      if (next) setDeeparPanelOpen(false);
      return next;
    });
  }, []);

  const camera = useCameraStream({
    enabled: open && available,
    audio: false,
    facingMode,
    videoIdeal: captureIdealRef.current,
    frameRate: WEBAR_CAMERA_FRAME_RATE,
    exactFacing: false,
  });

  const [inputStream, setInputStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    if (!open || !camera.ready) {
      setInputStream(null);
      return;
    }
    setInputStream(camera.stream);
  }, [open, camera.ready, camera.stream, facingMode]);

  useEffect(() => {
    const el = camera.videoRef.current;
    const stream = camera.stream;
    if (!el || !stream || !camera.ready) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [camera.ready, camera.stream, facingMode]);

  const streamBeauty = useStreamBeauty({
    enabled: open && camera.ready,
    inputStream,
    beautyId,
    effects: beautyEffects,
    bodyShape,
    mirror: false,
    keepWarm: open && webarConfigured && (beautyActive || beautyPanelOpen) && !faceArActive,
    beautyPanelOpen,
    loadCatalogs: beautyPanelOpen || beautyActive,
  });

  const beautyVideoReady = useVideoFrameReady(
    streamBeauty.outputVideoRef,
    open && beautyActive && !faceArActive && streamBeauty.active,
  );

  const facear = useFaceAR({
    previewRef,
    videoElementRef: camera.videoRef,
    enabled: open && available && camera.ready && faceArActive,
    preload: open && available && camera.ready,
    initialEffectId: faceEffectId,
    mirror: false,
  });

  useEffect(() => {
    const video = camera.videoRef.current;
    if (!video) return;
    const filter =
      beautyActive && !streamBeauty.configured && !faceArActive
        ? getBeautyVideoFilter(beautyId)
        : null;
    video.style.filter = filter ?? '';
    return () => {
      video.style.filter = '';
    };
  }, [beautyId, camera.ready, beautyActive, streamBeauty.configured, faceArActive]);

  useEffect(() => {
    if (open && webarConfigured) preloadTencentWebARModule();
  }, [open, webarConfigured]);

  useEffect(() => {
    if (!open) {
      setFaceEffectId('none');
      setBeautyId('none');
      setBeautyEffects(EMPTY_TENCENT_EFFECT_SELECTION);
      setBodyShape(EMPTY_BODY_SHAPE);
      setDeeparPanelOpen(false);
      setBeautyPanelOpen(false);
      setRecording(false);
      setFacingMode('user');
      rawRecorderRef.current = null;
      rawChunksRef.current = [];
    }
  }, [open]);

  useEffect(() => {
    if (recording) {
      setDeeparPanelOpen(false);
      setBeautyPanelOpen(false);
    }
  }, [recording]);

  const permissionDenied = camera.permissionDenied || facear.permissionDenied;
  const error = camera.error ?? facear.error ?? streamBeauty.error;
  const showBeautyPreview =
    beautyActive &&
    !faceArActive &&
    streamBeauty.configured &&
    streamBeauty.active &&
    beautyVideoReady;
  const previewReady = faceArActive
    ? facear.ready
    : showBeautyPreview || camera.ready;
  const panelOpen = (deeparPanelOpen || beautyPanelOpen) && !recording;

  if (!open) return null;

  const glassControlBtn =
    'w-14 h-14 rounded-full flex items-center justify-center border border-white/25 bg-black/55 backdrop-blur-md shadow-[0_4px_18px_rgba(0,0,0,0.5)]';
  const glassControlLabel =
    'text-[10px] font-bold uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]';

  const handlePhoto = async () => {
    if (showBeautyPreview && streamBeauty.outputVideoRef.current) {
      const dataUrl = await captureVideoFrame(streamBeauty.outputVideoRef.current, false);
      if (!dataUrl) return;
      onCaptured({ kind: 'photo', url: dataUrl });
      onClose();
      return;
    }

    if (beautyActive && camera.ready && !faceArActive) {
      const video = camera.videoRef.current;
      if (!video) return;
      const dataUrl = await captureVideoFrame(video, mirrorPreview);
      if (!dataUrl) return;
      onCaptured({ kind: 'photo', url: dataUrl });
      onClose();
      return;
    }

    if (faceArActive && facear.ready) {
      const dataUrl = await facear.takeScreenshot();
      if (!dataUrl) return;
      onCaptured({ kind: 'photo', url: dataUrl });
      onClose();
      return;
    }

    const video = camera.videoRef.current;
    if (!video) return;
    const dataUrl = await captureVideoFrame(video, mirrorPreview);
    if (!dataUrl) return;
    onCaptured({ kind: 'photo', url: dataUrl });
    onClose();
  };

  const startRawRecorder = (stream: MediaStream) => {
    rawChunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) rawChunksRef.current.push(event.data);
    };
    recorder.start();
    rawRecorderRef.current = recorder;
  };

  const finishRawRecorder = async (): Promise<Blob | null> => {
    const recorder = rawRecorderRef.current;
    if (!recorder) return null;
    return new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const chunks = rawChunksRef.current;
        resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || 'video/webm' }) : null);
      };
      recorder.stop();
    });
  };

  const handleToggleVideo = async () => {
    if (!recording) {
      if (faceArActive && facear.ready) {
        await facear.startVideoRecording(true);
        setRecording(true);
        return;
      }

      if (showBeautyPreview && streamBeauty.outputStreamRef.current) {
        startRawRecorder(streamBeauty.outputStreamRef.current);
        setRecording(true);
        return;
      }

      const stream = camera.streamRef.current;
      if (!stream) return;
      startRawRecorder(stream);
      setRecording(true);
      return;
    }

    if (faceArActive && facear.ready) {
      const blob = await facear.finishVideoRecording();
      setRecording(false);
      if (!blob) return;
      onCaptured({ kind: 'video', url: URL.createObjectURL(blob), blob });
      onClose();
      return;
    }

    const blob = await finishRawRecorder();
    rawRecorderRef.current = null;
    setRecording(false);
    if (!blob) return;
    onCaptured({ kind: 'video', url: URL.createObjectURL(blob), blob });
    onClose();
  };

  return (
    <div className={CAMERA_CAPTURE_ROOT_CLASS} data-app-overlay-root>
      {!available ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white/80">
          <p className="font-semibold mb-2">Camera not supported</p>
          <p className="text-sm max-w-sm">This browser cannot access the camera for capture.</p>
        </div>
      ) : (
        <div className="relative h-full w-full min-h-0">
          <CameraCaptureViewport
            rawStream={inputStream}
            beautyStream={streamBeauty.outputStream}
            showBeautyPreview={showBeautyPreview}
            mirrorRaw={mirrorPreview}
            facePreviewRef={previewRef}
            showFacePreview={faceArActive && facear.ready}
            beautySinkVideoRef={streamBeauty.outputVideoRef}
          />
          <video
            ref={camera.videoRef}
            playsInline
            muted
            autoPlay
            aria-hidden
            className="fixed h-px w-px opacity-0 pointer-events-none"
            style={{ left: -9999, top: -9999 }}
          />
          {permissionDenied ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/90 gap-4 bg-black">
              <p className="font-semibold">Camera permission required</p>
              <p className="text-sm text-white/70 max-w-sm">
                Allow camera in the address-bar icon, then tap Retry.
              </p>
              <button
                type="button"
                onClick={camera.retry}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
              >
                Retry
              </button>
            </div>
          ) : null}
          {error && !permissionDenied ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-red-300 text-sm bg-black/80 z-30">
              <p>{error}</p>
              <button
                type="button"
                onClick={camera.retry}
                className="px-4 py-2 rounded-lg bg-white/15 text-white text-sm font-bold"
              >
                Retry
              </button>
            </div>
          ) : null}

          {beautyPanelOpen ? (
            <LiveBeautySheet
              isOpen
              onClose={() => setBeautyPanelOpen(false)}
              activeBeautyId={beautyId}
              onSelectBeauty={handleSelectBeauty}
              effects={beautyEffects}
              onEffectsChange={handleBeautyEffectsChange}
              bodyShape={bodyShape}
              onBodyShapeChange={setBodyShape}
              catalogs={streamBeauty.catalogs}
              readyEffectIds={streamBeauty.readyEffectIds}
              anchorBottom={112}
              webarConfigured={webarConfigured}
              webarLoading={streamBeauty.loading}
              webarError={streamBeauty.error}
            />
          ) : null}

          <div className={`${CAMERA_CAPTURE_CHROME_CLASS} space-y-2`}>
            <div
              className={`pointer-events-auto overflow-hidden transition-all duration-300 ease-out ${
                panelOpen ? 'max-h-56 opacity-100 translate-y-0' : 'max-h-0 opacity-0 translate-y-2 pointer-events-none'
              }`}
            >
              {deeparPanelOpen ? (
                <ARFilterCarousel
                  activeEffectId={faceEffectId}
                  onSelect={(id) => {
                    handleSelectFaceAR(id);
                    if (id === faceEffectId) setDeeparPanelOpen(false);
                  }}
                  disabled={!camera.ready || recording}
                />
              ) : null}
            </div>

            <div className="pointer-events-auto flex items-center justify-center gap-3 flex-wrap">
              <CameraDualBeautyButtons
                variant="capture"
                disabled={recording || !camera.ready}
                deeparPanelOpen={deeparPanelOpen}
                beautyPanelOpen={beautyPanelOpen}
                deeparActive={faceArActive}
                beautyActive={beautyActive}
                onToggleDeepAR={toggleDeeparPanel}
                onToggleBeauty={toggleBeautyPanel}
                showDeepAR={deeparLicensed && !webarConfigured}
                showBeauty
              />
              <button
                type="button"
                onClick={onClose}
                className="flex flex-col items-center gap-1.5 text-white"
                aria-label="Close camera"
              >
                <span className={glassControlBtn}>
                  <X className="w-6 h-6" />
                </span>
                <span className={glassControlLabel}>Close</span>
              </button>
              <button
                type="button"
                disabled={!previewReady || recording}
                onClick={() => void handlePhoto()}
                className="flex flex-col items-center gap-1.5 text-white disabled:opacity-40"
              >
                <span className={glassControlBtn}>
                  <Camera className="w-6 h-6" />
                </span>
                <span className={glassControlLabel}>Photo</span>
              </button>
              <button
                type="button"
                disabled={!previewReady}
                onClick={() => void handleToggleVideo()}
                className="flex flex-col items-center gap-1.5 text-white disabled:opacity-40"
              >
                <span
                  className={`${glassControlBtn} ${
                    recording ? 'border-red-400/80 bg-red-500/35' : ''
                  }`}
                >
                  <Video className="w-6 h-6" />
                </span>
                <span className={glassControlLabel}>{recording ? 'Stop' : 'Video'}</span>
              </button>
              <button
                type="button"
                disabled={!previewReady || recording}
                onClick={flipCamera}
                className="flex flex-col items-center gap-1.5 text-white disabled:opacity-40"
                aria-label="Flip camera"
              >
                <span className={glassControlBtn}>
                  <SwitchCamera className="w-6 h-6" />
                </span>
                <span className={glassControlLabel}>
                  {facingMode === 'user' ? 'Selfie' : 'Back'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

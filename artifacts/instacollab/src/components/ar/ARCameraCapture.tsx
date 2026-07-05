import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Sparkles, SwitchCamera, Video, X } from 'lucide-react';
import { CameraDualBeautyButtons } from '../camera/CameraDualBeautyButtons';
import { isFaceARAvailable } from '../../lib/ar/arConfig';
import { useFaceAR } from '../../lib/ar/useFaceAR';
import {
  getBeautyVideoFilter,
  getTencentBeautifyParams,
  type BeautyPresetId,
} from '../../lib/ar/beautyFilters';
import {
  captureVideoFrame,
  type CameraFacingMode,
  useCameraStream,
} from '../../lib/camera/useCameraStream';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { isTencentWebARConfigured } from '../../lib/webar/webarConfig';
import { useTencentWebAR } from '../../lib/webar/useTencentWebAR';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentEffectSelection,
} from '../../lib/webar/webarTypes';
import { LiveBeautySheet } from '../../smule-rooms/components/LiveBeautySheet';
import { CameraBeautyBottomShell } from '../camera/CameraBeautyBottomShell';
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
  const [deeparPanelOpen, setDeeparPanelOpen] = useState(false);
  const [beautyPanelOpen, setBeautyPanelOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const rawRecorderRef = useRef<MediaRecorder | null>(null);
  const rawChunksRef = useRef<Blob[]>([]);
  const available = isFaceARAvailable();
  const deeparLicensed = isDeepARConfigured();
  const webarConfigured = isTencentWebARConfigured();
  const faceArActive = faceEffectId !== 'none';
  const beautyEffectsActive = Boolean(
    beautyEffects.makeupId ||
      beautyEffects.stickerId ||
      beautyEffects.filterId ||
      beautyEffects.backgroundUrl,
  );
  const beautyActive = beautyId !== 'none' || beautyEffectsActive;
  const mirrorPreview = facingMode === 'user';

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
    if (deeparLicensed) return;
    setDeeparPanelOpen((open) => {
      const next = !open;
      if (next) setBeautyPanelOpen(false);
      return next;
    });
  }, [deeparLicensed]);

  const toggleBeautyPanel = useCallback(() => {
    setBeautyPanelOpen((open) => {
      const next = !open;
      if (next) setDeeparPanelOpen(false);
      return next;
    });
  }, []);

  const camera = useCameraStream({
    enabled: open && available,
    audio: true,
    facingMode,
  });

  const [inputStream, setInputStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    if (!open || !camera.ready) {
      setInputStream(null);
      return;
    }
    const stream = camera.streamRef.current;
    setInputStream((prev) => (prev === stream ? prev : stream));
  }, [open, camera.ready, facingMode]);

  const webar = useTencentWebAR({
    enabled: open && camera.ready && beautyActive && !faceArActive,
    inputStream,
    mirror: mirrorPreview,
    beautify: getTencentBeautifyParams(beautyId),
    effects: beautyEffects,
  });

  const facear = useFaceAR({
    previewRef,
    videoElementRef: camera.videoRef,
    enabled: open && available && camera.ready && faceArActive,
    preload: open && available && camera.ready,
    initialEffectId: faceEffectId,
    mirror: mirrorPreview,
  });

  useEffect(() => {
    const video = camera.videoRef.current;
    if (!video) return;
    const filter =
      beautyActive && !webar.beautyActive && !faceArActive
        ? getBeautyVideoFilter(beautyId)
        : null;
    video.style.filter = filter ?? '';
    return () => {
      video.style.filter = '';
    };
  }, [beautyId, camera.ready, beautyActive, webar.beautyActive, faceArActive]);

  useEffect(() => {
    if (!open) {
      setFaceEffectId('none');
      setBeautyId('none');
      setBeautyEffects(EMPTY_TENCENT_EFFECT_SELECTION);
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
  const error = camera.error ?? facear.error ?? webar.error;
  const previewReady = faceArActive
    ? facear.ready
    : beautyActive
      ? webar.beautyActive || camera.ready
      : camera.ready;
  const previewLoading = faceArActive
    ? facear.loading || !camera.ready
    : beautyActive
      ? !camera.ready || (webarConfigured && webar.loading)
      : !camera.ready;

  if (!open) return null;

  const glassControlBtn =
    'w-14 h-14 rounded-full flex items-center justify-center border border-white/25 bg-black/55 backdrop-blur-md shadow-[0_4px_18px_rgba(0,0,0,0.5)]';
  const glassControlLabel =
    'text-[10px] font-bold uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]';

  const handlePhoto = async () => {
    if (beautyActive && camera.ready) {
      const video =
        webar.beautyActive && webar.outputVideoRef.current
          ? webar.outputVideoRef.current
          : camera.videoRef.current;
      if (!video) return;
      const dataUrl = await captureVideoFrame(video, webar.beautyActive ? false : mirrorPreview);
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

      if (beautyActive && webar.beautyActive && webar.outputStreamRef.current) {
        startRawRecorder(webar.outputStreamRef.current);
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
    <div className="fixed inset-0 z-[3200] flex flex-col bg-black" data-app-overlay-root>
      {!available ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white/80">
          <p className="font-semibold mb-2">Camera not supported</p>
          <p className="text-sm max-w-sm">This browser cannot access the camera for AR capture.</p>
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <video
            ref={camera.videoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
              mirrorPreview ? 'scale-x-[-1]' : ''
            } ${
              (faceArActive && facear.ready) || (beautyActive && webar.beautyActive)
                ? 'opacity-0 pointer-events-none'
                : 'opacity-100'
            }`}
          />
          <video
            ref={webar.outputVideoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
              beautyActive && webar.beautyActive
                ? 'opacity-100'
                : 'opacity-0 pointer-events-none'
            }`}
          />
          <div
            ref={previewRef}
            className={`absolute inset-0 w-full h-full transition-opacity duration-200 ${
              faceArActive && facear.ready ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
          {permissionDenied ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/90 gap-4 bg-black">
              <p className="font-semibold">Camera permission required</p>
              <p className="text-sm text-white/70 max-w-sm">
                Allow camera access in your browser settings, then reload.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
              >
                Reload
              </button>
            </div>
          ) : null}
          {previewLoading && !previewReady && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-3">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-xs text-white/70">
                {!camera.ready
                  ? 'Starting camera…'
                  : faceArActive && facear.loadProgress > 0
                    ? `Loading face AR… ${facear.loadProgress}%`
                    : faceArActive
                      ? 'Loading face AR…'
                      : beautyActive
                        ? 'Loading beauty…'
                        : 'Starting camera…'}
              </p>
            </div>
          )}
          {error && !permissionDenied && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-300 text-sm bg-black">
              {error}
            </div>
          )}

          {beautyPanelOpen ? (
            <LiveBeautySheet
              isOpen
              onClose={() => setBeautyPanelOpen(false)}
              activeBeautyId={beautyId}
              onSelectBeauty={handleSelectBeauty}
              effects={beautyEffects}
              onEffectsChange={handleBeautyEffectsChange}
              catalogs={webar.catalogs}
              anchorBottom={120}
              webarConfigured={webarConfigured}
              webarLoading={webar.loading}
              webarError={webar.error}
            />
          ) : null}

          <CameraBeautyBottomShell
            isOpen={deeparPanelOpen && !recording}
            onClose={() => setDeeparPanelOpen(false)}
            title="Face AR"
            titleIcon={<Sparkles size={12} aria-hidden />}
            accent="fuchsia"
            anchorBottom={120}
            loading={faceArActive && facear.loading}
            loadingLabel="Loading AR…"
          >
            <ARFilterCarousel
              activeEffectId={faceEffectId}
              onSelect={(id) => {
                handleSelectFaceAR(id);
                if (id === faceEffectId) setDeeparPanelOpen(false);
              }}
              disabled={!camera.ready || recording}
            />
          </CameraBeautyBottomShell>

          <div className="absolute inset-x-0 bottom-0 z-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 pointer-events-none">
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
                showDeepAR
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
                onClick={() =>
                  setFacingMode((current) => (current === 'user' ? 'environment' : 'user'))
                }
                className="flex flex-col items-center gap-1.5 text-white disabled:opacity-40"
                aria-label="Flip camera"
              >
                <span className={glassControlBtn}>
                  <SwitchCamera className="w-6 h-6" />
                </span>
                <span className={glassControlLabel}>Flip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

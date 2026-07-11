import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, SwitchCamera } from 'lucide-react';
import { CameraCaptureViewport } from '../../components/camera/CameraCaptureViewport';
import {
  getBeautyVideoFilter,
  type BeautyPresetId,
} from '../../lib/ar/beautyFilters';
import { EMPTY_BODY_SHAPE, isBodyShapeActive, type BodyShapeParams } from '../../lib/ar/bodyShape';
import { useStreamBeauty } from '../../lib/ar/useStreamBeauty';
import {
  getStableCameraIdeal,
  WEBAR_CAMERA_FRAME_RATE,
} from '../../lib/camera/cameraPipelinePolicy';
import {
  nextCameraFacingMode,
  shouldMirrorCameraPreview,
} from '../../lib/camera/cameraMirrorPolicy';
import { useCameraStream, type CameraFacingMode } from '../../lib/camera/useCameraStream';
import {
  hydrateTencentWebARCatalogsFromStorage,
  isTencentWebARConfigured,
  warmTencentWebARPipelineNow,
} from '../../lib/webar/useTencentWebAR';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentEffectSelection,
} from '../../lib/webar/webarTypes';
import { PREVIEW_AVATARS } from '../utils/roomModePreviewDemo';
import type { PendingCreateRoomBeauty } from '../utils/pendingCreateRoomBeauty';
import { readLastVideoCallBeauty, stashLastVideoCallBeauty } from '../../lib/ar/lastVideoCallBeauty';
import { LiveBeautySheet } from './LiveBeautySheet';

type CreateRoomLivePreviewProps = {
  mode: 'Solo-Live' | 'Commerce-Live';
  enabled: boolean;
  /** Fill parent edge-to-edge (Create Room Solo/Shop stage). */
  fill?: boolean;
  onSetupChange?: (setup: PendingCreateRoomBeauty) => void;
};

function initialBeautyFromLastCall() {
  return readLastVideoCallBeauty();
}

export function CreateRoomLivePreview({
  mode,
  enabled,
  fill = false,
  onSetupChange,
}: CreateRoomLivePreviewProps) {
  const isShop = mode === 'Commerce-Live';
  const webarConfigured = isTencentWebARConfigured();
  const captureIdealRef = useRef(getStableCameraIdeal(webarConfigured));
  const lastCallBeauty = useRef(initialBeautyFromLastCall()).current;

  const [beautyId, setBeautyId] = useState<BeautyPresetId>(
    () => lastCallBeauty?.beautyId ?? 'none',
  );
  const [beautyEffects, setBeautyEffects] = useState<TencentEffectSelection>(
    () => lastCallBeauty?.beautyEffects ?? EMPTY_TENCENT_EFFECT_SELECTION,
  );
  const [bodyShape, setBodyShape] = useState<BodyShapeParams>(
    () => lastCallBeauty?.bodyShape ?? EMPTY_BODY_SHAPE,
  );
  const [beautyPanelOpen, setBeautyPanelOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');

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

  const camera = useCameraStream({
    enabled,
    audio: false,
    facingMode,
    videoIdeal: captureIdealRef.current,
    frameRate: WEBAR_CAMERA_FRAME_RATE,
    exactFacing: true,
  });

  const [inputStream, setInputStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    if (!enabled || !camera.ready) {
      setInputStream(null);
      return;
    }
    setInputStream(camera.stream);
  }, [enabled, camera.ready, camera.stream, facingMode]);

  useEffect(() => {
    const el = camera.videoRef.current;
    const stream = camera.stream;
    if (!el || !stream || !camera.ready) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [camera.ready, camera.stream, facingMode]);

  const streamBeauty = useStreamBeauty({
    enabled: enabled && webarConfigured,
    inputStream,
    beautyId,
    effects: beautyEffects,
    bodyShape,
    mirror: mirrorPreview,
    keepWarm: enabled && webarConfigured,
    beautyPanelOpen: true,
    // Always load catalogs in Create Room so makeup/sticker trays stay warm.
    loadCatalogs: enabled && webarConfigured,
    // Keep TRTC processing on at all times so taps apply with no cold start.
    persistent: enabled && webarConfigured,
  });

  const beautyStream =
    streamBeauty.outputStream ?? streamBeauty.outputStreamRef.current ?? null;

  // Once TRTC is warm, always show its output — beauty/makeup/sticker/filter/BG apply on the live stream.
  const showBeautyPreview = Boolean(
    webarConfigured && streamBeauty.ready && (beautyStream || streamBeauty.outputVideoRef.current),
  );

  // CSS look only until TRTC frames are on screen.
  const cssFallbackFilter =
    beautyActive && !showBeautyPreview
      ? getBeautyVideoFilter(beautyId !== 'none' ? beautyId : 'beauty-natural')
      : null;

  useEffect(() => {
    if (!enabled || !webarConfigured) return;
    hydrateTencentWebARCatalogsFromStorage();
    warmTencentWebARPipelineNow();
  }, [enabled, webarConfigured]);

  useEffect(() => {
    onSetupChange?.({
      beautyId,
      beautyEffects,
      bodyShape,
      roomMode: mode,
    });
    stashLastVideoCallBeauty({ beautyId, beautyEffects, bodyShape });
  }, [beautyId, beautyEffects, bodyShape, mode, onSetupChange]);

  useEffect(() => {
    if (!enabled) {
      setBeautyPanelOpen(false);
    }
  }, [enabled]);

  const flipCamera = useCallback(() => {
    setFacingMode((current) => nextCameraFacingMode(current));
  }, []);

  const handleSelectBeauty = useCallback((nextBeautyId: BeautyPresetId) => {
    setBeautyId(nextBeautyId);
  }, []);

  const handleBeautyEffectsChange = useCallback((effects: TencentEffectSelection) => {
    setBeautyEffects(effects);
  }, []);

  const permissionDenied = camera.permissionDenied;
  const error = camera.error ?? streamBeauty.error;

  const stage = (
    <div
      className={
        fill
          ? 'absolute inset-0 overflow-hidden bg-black'
          : 'relative overflow-hidden rounded-2xl border border-white/10 bg-black aspect-[9/14] max-h-[22rem] sm:max-h-[26rem]'
      }
    >
      {enabled ? (
        <>
          <div
            className="absolute inset-0"
            style={cssFallbackFilter ? { filter: cssFallbackFilter } : undefined}
          >
            <CameraCaptureViewport
              rawStream={inputStream}
              beautyStream={beautyStream}
              showBeautyPreview={showBeautyPreview}
              mirrorRaw={mirrorPreview}
              beautySinkVideoRef={streamBeauty.outputVideoRef}
            />
          </div>
          <video
            ref={camera.videoRef}
            playsInline
            muted
            autoPlay
            aria-hidden
            className="fixed h-px w-px opacity-0 pointer-events-none"
            style={{ left: -9999, top: -9999 }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-slate-950" />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />

      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[9px] font-black uppercase text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        Preview
      </div>

      {!beautyPanelOpen ? (
        <>
          {isShop ? (
            <div className="absolute bottom-16 left-3 right-3 z-10 rounded-xl border border-amber-400/30 bg-black/70 p-2 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <img
                  src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80"
                  className="h-10 w-10 rounded-lg object-cover"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-black text-white">Wireless Earbuds Pro</p>
                  <p className="text-[9px] font-bold text-amber-300">$49.99 · pin products when live</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500 px-2 py-1 text-[8px] font-black text-black">
                  SHOP
                </span>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-16 left-0 right-0 z-10 flex justify-center gap-3 px-3">
              {[PREVIEW_AVATARS.guest1, PREVIEW_AVATARS.guest2, null].map((avatar, index) => (
                <div
                  key={`solo-guest-${index}`}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/50"
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[8px] font-black text-white/40">NO.{index + 1}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setBeautyPanelOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide backdrop-blur-md transition ${
                beautyActive
                  ? 'border-fuchsia-400/50 bg-fuchsia-500/25 text-fuchsia-100'
                  : 'border-white/20 bg-black/55 text-white'
              }`}
            >
              <Sparkles size={12} />
              Beauty
            </button>
            <button
              type="button"
              onClick={flipCamera}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md"
              aria-label="Flip camera"
            >
              <SwitchCamera size={15} />
            </button>
          </div>
        </>
      ) : null}

      {permissionDenied ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/90 px-4 text-center">
          <p className="text-sm font-bold text-white">Camera permission required</p>
          <p className="text-[11px] text-white/70">
            Allow camera access, then reload to preview before going live.
          </p>
        </div>
      ) : null}

      {error && !permissionDenied ? (
        <div className="absolute inset-x-0 top-12 z-20 px-3">
          <p className="rounded-lg bg-red-950/80 px-2 py-1.5 text-center text-[10px] font-semibold text-red-200">
            {error}
          </p>
        </div>
      ) : null}

      {enabled && !camera.ready && !permissionDenied && !error ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">
            Starting camera…
          </p>
        </div>
      ) : null}

      {beautyPanelOpen ? (
        <>
          <button
            type="button"
            className="absolute inset-0 z-[35] cursor-default bg-transparent"
            aria-label="Close beauty panel"
            onClick={() => setBeautyPanelOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-[40] flex max-h-[min(62%,32rem)] flex-col bg-transparent"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Beauty panel"
          >
            <div className="flex shrink-0 items-center justify-end gap-2 px-3 pt-2">
              <button
                type="button"
                onClick={() => setBeautyPanelOpen(false)}
                className="rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white drop-shadow transition hover:bg-black/60"
              >
                Done
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-transparent px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                variant="inline"
                webarConfigured={webarConfigured}
                webarLoading={false}
                webarError={streamBeauty.error}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );

  if (fill) {
    return (
      <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-black" aria-label={`${mode} camera preview`}>
        {stage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stage}
      <p className="text-center text-[9px] font-semibold text-slate-500">
        Set TRTC beauty now — tap Go Live for a 3-2-1 countdown into your stream.
      </p>
    </div>
  );
}

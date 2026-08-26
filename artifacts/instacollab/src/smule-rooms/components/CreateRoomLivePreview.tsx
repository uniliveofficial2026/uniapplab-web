import { useCallback, useEffect, useRef, useState } from 'react';
import { Sofa, Sparkles, SwitchCamera, Grid2X2 } from 'lucide-react';
import { CameraCaptureViewport } from '../../components/camera/CameraCaptureViewport';
import { CallVideoSurface } from '../../components/messages/CallVideoSurface';
import {
  isTencentBeautifyActive,
  resolveBeautyCssFilter,
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
  readCameraFacingMode,
  shouldMirrorCameraPreview,
} from '../../lib/camera/cameraMirrorPolicy';
import { getAppCameraFacing, setAppCameraFacing } from '../../lib/camera/appCameraOwner';
import { useTrtcCameraInput } from '../../lib/camera/trtcCameraPipeline';
import { useCameraStream, type CameraFacingMode } from '../../lib/camera/useCameraStream';
import { emitCameraSwitchTrace } from '../../lib/camera/cameraSwitchTrace';
import { useVideoFrameReady } from '../../lib/camera/useVideoFrameReady';
import {
  hydrateTencentWebARCatalogsFromStorage,
  isTencentWebARConfigured,
  warmTencentWebARPipelineNow,
} from '../../lib/webar/useTencentWebAR';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentBeautifyParams,
  type TencentEffectSelection,
} from '../../lib/webar/webarTypes';
import { PREVIEW_AVATARS } from '../utils/roomModePreviewDemo';
import type { PendingCreateRoomBeauty } from '../utils/pendingCreateRoomBeauty';
import { readLastVideoCallBeauty, stashLastVideoCallBeauty } from '../../lib/ar/lastVideoCallBeauty';
import { LiveBeautySheet } from './LiveBeautySheet';
import {
  formatMultiGuestLayoutOptionLabel,
  formatMultiGuestSeatLabel,
  getMultiGuestVideoLayout,
  MULTI_GUEST_SEAT_COUNT_OPTIONS,
  resolveMultiGuestSeatCount,
  type MultiGuestSeatCount,
} from '../utils/roomSeats';

type CreateRoomLivePreviewProps = {
  mode: 'Solo-Live' | 'Commerce-Live' | 'Multi-Guest';
  enabled: boolean;
  /** Fill parent edge-to-edge (Create Room Solo/Shop stage). */
  fill?: boolean;
  initialSeatCount?: MultiGuestSeatCount;
  onSetupChange?: (setup: PendingCreateRoomBeauty) => void;
};

function initialBeautyFromLastCall() {
  return readLastVideoCallBeauty();
}

export function CreateRoomLivePreview({
  mode,
  enabled,
  fill = false,
  initialSeatCount,
  onSetupChange,
}: CreateRoomLivePreviewProps) {
  const isShop = mode === 'Commerce-Live';
  const isMulti = mode === 'Multi-Guest';
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
  const [beautifyOverride, setBeautifyOverride] = useState<TencentBeautifyParams | null>(
    () => lastCallBeauty?.beautifyOverride ?? null,
  );
  const [beautyPanelOpen, setBeautyPanelOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const [seatCount, setSeatCount] = useState<MultiGuestSeatCount>(() =>
    resolveMultiGuestSeatCount(initialSeatCount),
  );

  const beautyEffectsActive = Boolean(
    beautyEffects.makeupId ||
      beautyEffects.stickerId ||
      beautyEffects.filterId ||
      beautyEffects.backgroundUrl ||
      beautyEffects.shapeEffectId,
  );
  const shapeActive = isBodyShapeActive(bodyShape);
  const overrideActive = Boolean(beautifyOverride && isTencentBeautifyActive(beautifyOverride));
  const beautyActive = beautyId !== 'none' || beautyEffectsActive || shapeActive || overrideActive;
  const mirrorPreview = shouldMirrorCameraPreview(facingMode);

  const camera = useCameraStream({
    enabled,
    audio: false,
    facingMode,
    videoIdeal: captureIdealRef.current,
    frameRate: WEBAR_CAMERA_FRAME_RATE,
    exactFacing: facingMode === 'environment',
  });

  const inputStream = useTrtcCameraInput(enabled, camera, facingMode);

  useEffect(() => {
    const el = camera.videoRef.current;
    const stream = camera.stream;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [camera.stream, facingMode]);

  const streamBeauty = useStreamBeauty({
    enabled: enabled && webarConfigured,
    inputStream,
    beautyId,
    effects: beautyEffects,
    bodyShape,
    beautifyOverride,
    mirror: false,
    keepWarm: enabled && webarConfigured && Boolean(inputStream || camera.stream),
    beautyPanelOpen,
    loadCatalogs: enabled && webarConfigured,
    persistent: enabled && webarConfigured && beautyActive,
  });

  const beautyStream =
    streamBeauty.outputStream ?? streamBeauty.outputStreamRef.current ?? null;

  const beautyOutputLive = Boolean(
    beautyStream?.getVideoTracks().some((track) => track.readyState === 'live'),
  );
  const beautyFramesReady = useVideoFrameReady(
    streamBeauty.outputVideoRef,
    enabled && webarConfigured && beautyActive && streamBeauty.ready && beautyOutputLive,
  );

  const trtcOutputReady = Boolean(
    webarConfigured &&
      beautyActive &&
      streamBeauty.ready &&
      (beautyOutputLive || beautyFramesReady),
  );

  // Raw camera for zero-latency preview; beauty overlay only when effects are on.
  const showBeautyPreview = trtcOutputReady;
  const showProcessedPreview = showBeautyPreview;

  // CSS look only until TRTC frames are on screen.
  const cssFallbackFilter =
    beautyActive && !showProcessedPreview
      ? resolveBeautyCssFilter(beautyId, beautifyOverride)
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
      beautifyOverride,
      roomMode: mode,
      ...(mode === 'Multi-Guest' ? { multiGuestSeatCount: seatCount } : {}),
    });
    stashLastVideoCallBeauty({ beautyId, beautyEffects, bodyShape, beautifyOverride });
  }, [beautyId, beautyEffects, bodyShape, beautifyOverride, mode, onSetupChange, seatCount]);

  useEffect(() => {
    if (!enabled) {
      setBeautyPanelOpen(false);
    }
  }, [enabled]);

  const flipCamera = useCallback(() => {
    const requested = nextCameraFacingMode(facingMode);
    emitCameraSwitchTrace('CAMERA_SWITCH_TAP', { requested, from: facingMode, surface: 'create-room' });
    void setAppCameraFacing(requested)
      .then((stream) => {
        const actual =
          readCameraFacingMode(stream?.getVideoTracks()[0], getAppCameraFacing());
        setFacingMode(actual);
      })
      .catch(() => {
        setFacingMode(getAppCameraFacing());
      });
  }, [facingMode]);

  const handleSelectBeauty = useCallback((nextBeautyId: BeautyPresetId) => {
    setBeautifyOverride(null);
    setBeautyId(nextBeautyId);
  }, []);

  const handleBeautyEffectsChange = useCallback((effects: TencentEffectSelection) => {
    setBeautyEffects(effects);
  }, []);

  const handleBeautifyParamsChange = useCallback((params: TencentBeautifyParams) => {
    setBeautifyOverride(params);
  }, []);

  const permissionDenied = camera.permissionDenied;
  const cameraError = camera.error;
  const beautyError = streamBeauty.error;
  const previewStream = inputStream ?? camera.stream ?? camera.streamRef.current;
  const multiLayout = isMulti ? getMultiGuestVideoLayout(seatCount) : [];

  const cameraFeed = (tileLayout: 'fullscreen' | 'fill' = 'fullscreen') =>
    enabled ? (
      <>
        <div
          className={
            tileLayout === 'fill'
              ? 'relative h-full w-full overflow-hidden'
              : 'absolute inset-0 overflow-hidden'
          }
          style={cssFallbackFilter ? { filter: cssFallbackFilter } : undefined}
        >
          <CameraCaptureViewport
            rawStream={previewStream}
            beautyStream={beautyStream}
            showBeautyPreview={showBeautyPreview}
            mirrorRaw={mirrorPreview}
            beautySinkVideoRef={streamBeauty.outputVideoRef}
            layout={tileLayout}
          />
        </div>
        {tileLayout === 'fullscreen' ? (
          <video
            ref={camera.videoRef}
            playsInline
            muted
            autoPlay
            aria-hidden
            className="fixed h-px w-px opacity-0 pointer-events-none"
            style={{ left: -9999, top: -9999 }}
          />
        ) : null}
      </>
    ) : (
      <div className="absolute inset-0 bg-slate-950" />
    );

  const captureElement = (
    <video
      ref={camera.videoRef}
      playsInline
      muted
      autoPlay
      aria-hidden
      className="fixed h-px w-px opacity-0 pointer-events-none"
      style={{ left: -9999, top: -9999 }}
    />
  );

  const beautyControls = !beautyPanelOpen ? (
    <div className={`z-10 flex items-center justify-between gap-2 ${isMulti ? 'create-room-multi-host-actions' : 'absolute bottom-3 left-3 right-3'}`}>
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
        aria-label="camera-switch"
        data-testid="camera-switch"
        title="Flip camera"
      >
        <SwitchCamera size={15} />
      </button>
    </div>
  ) : null;

  const stage = (
    <div
      className={
        fill
          ? 'absolute inset-0 overflow-hidden bg-black'
          : 'relative overflow-hidden rounded-2xl border border-white/10 bg-black aspect-[9/14] max-h-[22rem] sm:max-h-[26rem]'
      }
    >
      {isMulti ? (
        <div className="create-room-multi-preview">
          {captureElement}
          <div className="create-room-multi-layout-bar">
            <span className="create-room-multi-layout-title">
              <Grid2X2 size={13} /> Layout
            </span>
            <div className="create-room-multi-layout-btns">
              {MULTI_GUEST_SEAT_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`create-room-multi-layout-btn${seatCount === count ? ' is-active' : ''}`}
                  onClick={() => setSeatCount(count)}
                >
                  {formatMultiGuestLayoutOptionLabel(count)}
                </button>
              ))}
            </div>
          </div>
          <div className={`create-room-multi-grid create-room-multi-grid--${seatCount}`}>
            {multiLayout.map((item) => {
              const label = formatMultiGuestSeatLabel(item.seatKey, seatCount, { uppercase: true });
              const isHost = item.seatKey === 'host';
              return (
                <div
                  key={item.seatKey}
                  className={`create-room-multi-tile${isHost ? ' create-room-multi-tile--host' : ''}`}
                  style={{
                    ...(item.gridColumn ? { gridColumn: item.gridColumn } : {}),
                    ...(item.gridRow ? { gridRow: item.gridRow } : {}),
                  }}
                >
                  {isHost ? (
                    <>
                      <div className="create-room-multi-host-cam">
                        {enabled ? (
                          <CallVideoSurface
                            stream={
                              showBeautyPreview && beautyStream
                                ? beautyStream
                                : previewStream
                            }
                            layout="fill"
                            framing="cover"
                            mirrored={mirrorPreview}
                            label="Camera preview"
                          />
                        ) : (
                          <div className="h-full w-full bg-slate-950" />
                        )}
                      </div>
                      <div className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-red-600/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        Preview
                      </div>
                      <span className="create-room-multi-host-label">{label}</span>
                      {beautyControls}
                    </>
                  ) : (
                    <div className="create-room-multi-empty">
                      <Sofa size={20} className="create-room-multi-empty-icon" aria-hidden />
                      <span className="create-room-multi-empty-label">{label}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {cameraFeed('fullscreen')}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[9px] font-black uppercase text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Preview
          </div>
          {!beautyPanelOpen ? (
            isShop ? (
              <div className="absolute bottom-16 left-3 z-10 aspect-square w-[7.25rem] overflow-hidden rounded-xl border border-amber-400/30 bg-black/80 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                <img
                  src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=240"
                  className="absolute inset-0 h-full w-full object-cover"
                  alt=""
                />
                <span className="absolute right-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[7px] font-black text-black">
                  SHOP
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-1.5 pb-1.5 pt-6">
                  <p className="truncate text-[9px] font-black leading-tight text-white">Wireless Earbuds Pro</p>
                  <p className="text-[8px] font-bold text-amber-300">$49.99</p>
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
            )
          ) : null}
        </>
      )}

      {isMulti ? null : beautyControls}

      {permissionDenied ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90 px-4 text-center">
          <p className="text-sm font-bold text-white">Camera permission required</p>
          <p className="text-[11px] text-white/70">
            Allow camera in the address-bar icon, then tap Retry.
          </p>
          <button
            type="button"
            onClick={camera.retry}
            className="rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-[11px] font-black uppercase tracking-wide text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {cameraError && !permissionDenied ? (
        <div className="absolute inset-x-0 top-12 z-20 flex flex-col items-center gap-2 px-3">
          <p className="rounded-lg bg-red-950/80 px-2 py-1.5 text-center text-[10px] font-semibold text-red-200">
            {cameraError}
          </p>
          <button
            type="button"
            onClick={camera.retry}
            className="rounded-full border border-white/25 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white"
          >
            Retry
          </button>
        </div>
      ) : beautyError && previewStream ? (
        <div className="absolute inset-x-0 top-12 z-20 px-3">
          <p className="rounded-lg bg-amber-950/80 px-2 py-1.5 text-center text-[10px] font-semibold text-amber-200">
            Beauty unavailable — camera preview is still live
          </p>
        </div>
      ) : null}

      {enabled && !previewStream && !permissionDenied && !cameraError ? (
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
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-transparent px-3 py-2 pb-[max(0.75rem,var(--app-composer-bottom-inset))]">
              <LiveBeautySheet
                isOpen
                onClose={() => setBeautyPanelOpen(false)}
                activeBeautyId={beautyId}
                onSelectBeauty={handleSelectBeauty}
                effects={beautyEffects}
                onEffectsChange={handleBeautyEffectsChange}
                bodyShape={bodyShape}
                onBodyShapeChange={setBodyShape}
                onBeautifyParamsChange={handleBeautifyParamsChange}
                beautifyOverride={beautifyOverride}
                catalogs={streamBeauty.catalogs}
                readyEffectIds={streamBeauty.readyEffectIds}
                variant="inline"
                webarConfigured={webarConfigured}
                webarLoading={streamBeauty.loading}
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

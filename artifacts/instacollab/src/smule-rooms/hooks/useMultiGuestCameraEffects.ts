import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useCameraStream, type CameraFacingMode } from '../../lib/camera/useCameraStream';
import {
  getStableCameraIdeal,
  shouldPreloadTrtcModule,
  shouldRunTrtcEngine,
  shouldRunTrtcProcessing,
  WEBAR_CAMERA_FRAME_RATE,
} from '../../lib/camera/cameraPipelinePolicy';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import {
  deeparSelectionActive,
  deeparSelectionFromEffectId,
  type DeepAREffectSelection,
} from '../../lib/deepar/deeparEffectSelection';
import { useDeepAR } from '../../lib/deepar/useDeepAR';
import {
  getBeautyVideoFilter,
  resolveTencentBeautifyParams,
  type BeautyPresetId,
} from '../../lib/ar/beautyFilters';
import { isBodyShapeActive, BODY_SHAPE_COMING_SOON, type BodyShapeParams } from '../../lib/ar/bodyShape';
import { useVideoFrameReady } from '../../lib/camera/useVideoFrameReady';
import {
  isTencentWebARConfigured,
  useTencentWebAR,
  warmTencentWebARPipelineNow,
} from '../../lib/webar/useTencentWebAR';
import type { TencentEffectItem, TencentEffectSelection } from '../../lib/webar/webarTypes';
import { EMPTY_BODY_SHAPE, EMPTY_TENCENT_EFFECT_SELECTION } from '../../lib/webar/webarTypes';
import { prepareProcessedVideoTrackForLiveKit } from '../../lib/livekit/liveKitVideoPublish';

/** LiveKit publish rate — 30fps keeps CPU lower than capture-every-paint (0). */
const LIVE_CANVAS_FPS = 30;

type UseMultiGuestCameraEffectsOptions = {
  enabled: boolean;
  effectId?: string;
  effectSelection?: DeepAREffectSelection;
  beautyId?: BeautyPresetId;
  beautyEffects?: TencentEffectSelection;
  bodyShape?: BodyShapeParams;
  beautyPanelOpen?: boolean;
  effectsPanelOpen?: boolean;
};

export type MultiGuestCameraEffectsState = {
  videoTrack: MediaStreamTrack | null;
  rawVideoRef: RefObject<HTMLVideoElement | null>;
  previewRef: RefObject<HTMLDivElement | null>;
  beautyVideoRef: RefObject<HTMLVideoElement | null>;
  configured: boolean;
  cameraReady: boolean;
  cameraFacingMode: CameraFacingMode;
  toggleCameraFacing: () => void;
  arActive: boolean;
  arReady: boolean;
  arLoading: boolean;
  showDeeparPreview: boolean;
  /** Tencent WebAR beauty is processing and ready. */
  beautyConfigured: boolean;
  beautyReady: boolean;
  beautyLoading: boolean;
  beautyError: string | null;
  showBeautyPreview: boolean;
  /** Beauty output has decoded frames (avoids black flash). */
  beautyVideoReady: boolean;
  /** CSS fallback when WebAR credentials are missing. */
    beautyCssFilter: string | null;
  beautyCatalogs: {
    makeups: TencentEffectItem[];
    stickers: TencentEffectItem[];
    filters: TencentEffectItem[];
    backgrounds: string[];
    beautyCovers: Record<string, string>;
    shapeCovers: Record<string, string>;
    bodyShapes: TencentEffectItem[];
    shapeEffectByPreset: Record<string, string>;
  };
  readyEffectIds: string[];
};

/**
 * Live camera + optional DeepAR + Tencent WebAR (TRTC) beauty for Multi-Guest / Solo Live.
 * When `DEEPAR_ENABLED` is false, publish priority is Tencent beauty output → raw camera.
 */
export function useMultiGuestCameraEffects({
  enabled,
  effectId = 'none',
  effectSelection,
  beautyId = 'none',
  beautyEffects = EMPTY_TENCENT_EFFECT_SELECTION,
  bodyShape = EMPTY_BODY_SHAPE,
  beautyPanelOpen = false,
  effectsPanelOpen = false,
}: UseMultiGuestCameraEffectsOptions): MultiGuestCameraEffectsState {
  const configured = isDeepARConfigured();
  const beautyConfigured = isTencentWebARConfigured();
  const selection = effectSelection ?? deeparSelectionFromEffectId(effectId);
  const effectSelected = configured && deeparSelectionActive(selection);
  const beautyEffectsActive = Boolean(
    beautyEffects.makeupId ||
      beautyEffects.stickerId ||
      beautyEffects.filterId ||
      beautyEffects.backgroundUrl ||
      beautyEffects.shapeEffectId,
  );
  const shapeActive = !BODY_SHAPE_COMING_SOON && isBodyShapeActive(bodyShape);
  const beautySelected = beautyId !== 'none' || beautyEffectsActive || shapeActive;
  const deeparWarm = configured && (effectSelected || effectsPanelOpen);
  const trtcWarm = enabled && beautyConfigured;
  const trtcEngine =
    trtcWarm ||
    shouldRunTrtcEngine({
      trtcCapable: beautyConfigured,
      beautySelected,
      beautyPanelOpen,
    });
  const trtcProcessing =
    trtcWarm ||
    shouldRunTrtcProcessing({
      trtcCapable: beautyConfigured,
      beautySelected,
    });

  useEffect(() => {
    if (enabled && beautyConfigured) warmTencentWebARPipelineNow();
  }, [beautyConfigured, enabled]);

  /** Fixed for this mount — toggling beauty must not restart getUserMedia. */
  const captureIdealRef = useRef(getStableCameraIdeal(beautyConfigured));

  useEffect(() => {
    if (enabled && shouldPreloadTrtcModule()) warmTencentWebARPipelineNow();
  }, [enabled]);

  const previewRef = useRef<HTMLDivElement>(null);
  const publishTrackRef = useRef<MediaStreamTrack | null>(null);
  const publishSourceRef = useRef<'raw' | 'canvas' | 'beauty' | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [inputStream, setInputStream] = useState<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const mirrorSelf = facingMode === 'user';

  const toggleCameraFacing = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  const camera = useCameraStream({
    enabled,
    audio: false,
    facingMode,
    videoIdeal: captureIdealRef.current,
    frameRate: WEBAR_CAMERA_FRAME_RATE,
  });

  const cameraReady = camera.ready;

  useEffect(() => {
    if (!enabled) {
      setInputStream(null);
      return;
    }
    // Keep last live stream across brief camera flips so TRTC does not tear down.
    if (!cameraReady) return;
    const next = camera.streamRef.current;
    if (next) setInputStream(next);
  }, [camera.streamRef, cameraReady, enabled, facingMode]);

  const beautifyParams = useMemo(
    () => resolveTencentBeautifyParams(beautyId, bodyShape),
    [beautyId, JSON.stringify(bodyShape)],
  );
  const webar = useTencentWebAR({
    enabled: enabled && cameraReady && trtcEngine,
    inputStream,
    mirror: mirrorSelf,
    beautify: beautifyParams,
    effects: beautyEffects,
    loadCatalogs: beautyPanelOpen && beautyConfigured,
    persistent: trtcWarm,
  });

  const deepar = useDeepAR({
    previewRef,
    videoElementRef: camera.videoRef,
    enabled: enabled && cameraReady && deeparWarm,
    processingActive: effectSelected,
    effectSelection: selection,
    initialEffectId: effectId,
    mirror: mirrorSelf,
    bodyShape,
  });

  const beautyVideoReady = useVideoFrameReady(
    webar.outputVideoRef,
    enabled && cameraReady && trtcProcessing,
  );

  const showDeeparPreview = effectSelected && deepar.ready;
  const showBeautyPreview =
    beautySelected &&
    !showDeeparPreview &&
    ((beautyConfigured && webar.ready && beautyVideoReady) ||
      (!beautyConfigured && Boolean(getBeautyVideoFilter(beautyId))));
  const beautyCssFilter =
    beautySelected && !beautyConfigured && !showDeeparPreview
      ? getBeautyVideoFilter(beautyId)
      : null;

  // Reconnect only when the camera stream identity changes — not on every effect swap.
  useEffect(() => {
    if (cameraReady && deepar.ready) {
      deepar.reconnectExternalVideo();
    }
  }, [cameraReady, deepar.ready, deepar.reconnectExternalVideo, facingMode]);

  const publishRaw = (rawTrack: MediaStreamTrack | null) => {
    if (!rawTrack) return;
    if (publishSourceRef.current === 'raw' && publishTrackRef.current === rawTrack) return;
    publishSourceRef.current = 'raw';
    publishTrackRef.current = rawTrack;
    setVideoTrack(rawTrack);
  };

  const publishCanvas = (canvasTrack: MediaStreamTrack | null) => {
    if (!canvasTrack) return;
    const prepared = prepareProcessedVideoTrackForLiveKit(canvasTrack);
    if (publishSourceRef.current === 'canvas' && publishTrackRef.current === prepared) return;
    publishSourceRef.current = 'canvas';
    publishTrackRef.current = prepared;
    setVideoTrack(prepared);
  };

  const publishBeauty = (beautyTrack: MediaStreamTrack | null) => {
    if (!beautyTrack) return;
    const prepared = prepareProcessedVideoTrackForLiveKit(beautyTrack);
    if (publishSourceRef.current === 'beauty' && publishTrackRef.current === prepared) return;
    publishSourceRef.current = 'beauty';
    publishTrackRef.current = prepared;
    setVideoTrack(prepared);
  };

  useEffect(() => {
    if (!enabled || !cameraReady) {
      publishTrackRef.current = null;
      publishSourceRef.current = null;
      setVideoTrack(null);
      return undefined;
    }

    const rawTrack = camera.streamRef.current?.getVideoTracks()[0] ?? null;

    if (effectSelected && deepar.ready) {
      let cancelled = false;
      let rafId = 0;

      const attachCanvasTrack = () => {
        if (cancelled) return;
        const canvasStream = deepar.getCanvasStream(LIVE_CANVAS_FPS);
        const canvasTrack = canvasStream?.getVideoTracks()[0] ?? null;
        if (canvasTrack) {
          publishCanvas(canvasTrack);
          return;
        }
        rafId = requestAnimationFrame(attachCanvasTrack);
      };

      attachCanvasTrack();
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
      };
    }

    if (beautySelected && webar.ready && beautyConfigured && beautyVideoReady) {
      const beautyTrack = webar.outputStreamRef.current?.getVideoTracks()[0] ?? null;
      if (beautyTrack) {
        publishBeauty(beautyTrack);
        return undefined;
      }
    }

    publishRaw(rawTrack);
    return undefined;
  }, [
    beautySelected,
    camera.ready,
    camera.streamRef,
    cameraReady,
    deepar.getCanvasStream,
    deepar.ready,
    effectSelected,
    enabled,
    effectId,
    facingMode,
    selection,
    trtcProcessing,
    webar.beautyActive,
    webar.ready,
    webar.outputStreamRef,
    beautyVideoReady,
    beautyId,
    beautyEffects,
    bodyShape,
  ]);

  return {
    videoTrack,
    rawVideoRef: camera.videoRef,
    previewRef,
    beautyVideoRef: webar.outputVideoRef,
    configured,
    cameraReady,
    cameraFacingMode: facingMode,
    toggleCameraFacing,
    arActive: effectSelected,
    arReady: deepar.ready,
    arLoading: deepar.loading,
    showDeeparPreview,
    beautyConfigured,
    beautyReady: webar.ready,
    beautyLoading: webar.loading,
    beautyError: webar.error,
    showBeautyPreview,
    beautyVideoReady,
    beautyCssFilter,
    beautyCatalogs: webar.catalogs,
    readyEffectIds: webar.readyEffectIds,
  };
}

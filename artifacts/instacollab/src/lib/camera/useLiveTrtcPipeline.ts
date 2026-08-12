/**
 * Live room TRTC + camera pipeline — Solo Live, Multi-Guest, Game Live.
 * LiveKit carries media; TRTC WebAR processes local video before publish.
 * UI shells (SoloLiveView, MultiGuestView, etc.) stay design-only.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  getBeautyVideoFilter,
  type BeautyPresetId,
} from '../ar/beautyFilters';
import { isBodyShapeActive, BODY_SHAPE_COMING_SOON, type BodyShapeParams } from '../ar/bodyShape';
import { useStreamBeauty } from '../ar/useStreamBeauty';
import {
  getStableCameraIdeal,
  shouldPreloadTrtcModule,
  WEBAR_CAMERA_FRAME_RATE,
} from './cameraPipelinePolicy';
import { prepareProcessedVideoTrackForLiveKit } from '../livekit/liveKitVideoPublish';
import { isDeepARConfigured } from '../deepar/deeparConfig';
import {
  deeparSelectionActive,
  deeparSelectionFromEffectId,
  type DeepAREffectSelection,
} from '../deepar/deeparEffectSelection';
import { useDeepAR } from '../deepar/useDeepAR';
import { useCameraStream, type CameraFacingMode } from './useCameraStream';
import { resolveCameraReady, useTrtcCameraInput } from './trtcCameraPipeline';
import { useVideoFrameReady } from './useVideoFrameReady';
import { isTencentWebARConfigured, warmTencentWebARPipelineNow } from '../webar/useTencentWebAR';
import type { TencentEffectItem, TencentEffectSelection } from '../webar/webarTypes';
import { EMPTY_BODY_SHAPE, EMPTY_TENCENT_EFFECT_SELECTION } from '../webar/webarTypes';

/** LiveKit publish rate — 30fps keeps CPU lower than capture-every-paint (0). */
const LIVE_CANVAS_FPS = 30;

export type UseLiveTrtcPipelineOptions = {
  enabled: boolean;
  effectId?: string;
  effectSelection?: DeepAREffectSelection;
  beautyId?: BeautyPresetId;
  beautyEffects?: TencentEffectSelection;
  bodyShape?: BodyShapeParams;
  beautyPanelOpen?: boolean;
  effectsPanelOpen?: boolean;
};

export type LiveTrtcPipelineState = {
  videoTrack: MediaStreamTrack | null;
  rawVideoRef: RefObject<HTMLVideoElement | null>;
  previewRef: RefObject<HTMLDivElement | null>;
  beautyVideoRef: RefObject<HTMLVideoElement | null>;
  configured: boolean;
  cameraReady: boolean;
  cameraError: string | null;
  cameraPermissionDenied: boolean;
  retryCamera: () => void;
  cameraFacingMode: CameraFacingMode;
  toggleCameraFacing: () => void;
  arActive: boolean;
  arReady: boolean;
  arLoading: boolean;
  showDeeparPreview: boolean;
  beautyConfigured: boolean;
  beautyReady: boolean;
  beautyLoading: boolean;
  beautyError: string | null;
  showBeautyPreview: boolean;
  showProcessedPreview: boolean;
  beautyVideoReady: boolean;
  beautyCssFilter: string | null;
  beautyOutputStream: MediaStream | null;
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

export function useLiveTrtcPipeline({
  enabled,
  effectId = 'none',
  effectSelection,
  beautyId = 'none',
  beautyEffects = EMPTY_TENCENT_EFFECT_SELECTION,
  bodyShape = EMPTY_BODY_SHAPE,
  beautyPanelOpen = false,
  effectsPanelOpen = false,
}: UseLiveTrtcPipelineOptions): LiveTrtcPipelineState {
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
  const deeparWarm =
    configured && !beautyConfigured && (effectSelected || effectsPanelOpen);
  /** Publish processed frames only while an effect is actually selected. */
  const trtcProcessing = enabled && beautyConfigured && beautySelected && !effectSelected;

  const captureIdealRef = useRef(getStableCameraIdeal(beautyConfigured));
  const previewRef = useRef<HTMLDivElement>(null);
  const publishTrackRef = useRef<MediaStreamTrack | null>(null);
  const publishSourceRef = useRef<'raw' | 'canvas' | 'beauty' | null>(null);
  const inputTrackIdRef = useRef('');
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const mirrorSelf = facingMode === 'user';

  useEffect(() => {
    if (enabled && shouldPreloadTrtcModule()) warmTencentWebARPipelineNow();
  }, [enabled]);

  const toggleCameraFacing = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  const camera = useCameraStream({
    enabled,
    audio: false,
    facingMode,
    videoIdeal: captureIdealRef.current,
    frameRate: WEBAR_CAMERA_FRAME_RATE,
    exactFacing: false,
  });

  const cameraReady = resolveCameraReady(camera);
  const inputStream = useTrtcCameraInput(enabled, camera, facingMode);
  const inputTrackId = inputStream?.getVideoTracks()[0]?.id ?? '';

  /**
   * Warm the shared WebAR GPU as soon as the live camera is ready.
   * Previously we waited for beauty panel open / effect select — that made the
   * first beauty open pay for SDK download + WebGL init + catalog fetch (~seconds).
   */
  const trtcWarm =
    enabled &&
    beautyConfigured &&
    !effectSelected &&
    (beautySelected || beautyPanelOpen || cameraReady);

  const beauty = useStreamBeauty({
    enabled: enabled && beautyConfigured,
    keepWarm: trtcWarm,
    inputStream,
    beautyId,
    effects: beautyEffects,
    bodyShape: BODY_SHAPE_COMING_SOON ? undefined : bodyShape,
    mirror: false,
    beautyPanelOpen: enabled && beautyPanelOpen,
    loadCatalogs:
      enabled && beautyConfigured && (beautyPanelOpen || beautySelected || cameraReady),
    persistent: trtcProcessing,
  });

  const deepar = useDeepAR({
    previewRef,
    videoElementRef: camera.videoRef,
    enabled: enabled && cameraReady && deeparWarm,
    processingActive: effectSelected,
    effectSelection: selection,
    initialEffectId: effectId,
    mirror: false,
    bodyShape,
  });

  const beautyVideoReady = useVideoFrameReady(
    beauty.outputVideoRef,
    enabled && beautyConfigured && beautySelected && beauty.ready,
  );

  const beautyOutputStream =
    beauty.outputStream ?? beauty.outputStreamRef.current ?? null;

  const showDeeparPreview = effectSelected && deepar.ready;

  /**
   * Beauty GPU output is "ready" only while frames are actually advancing
   * (useVideoFrameReady watchdog). If WebAR stalls, this flips false so the UI
   * falls back to the instant CSS-beautified raw camera instead of a frozen frame.
   */
  const trtcOutputReady =
    enabled &&
    beautyConfigured &&
    beautySelected &&
    beauty.ready &&
    !showDeeparPreview &&
    beautyVideoReady &&
    Boolean(beautyOutputStream);

  const showProcessedPreview = trtcOutputReady || showDeeparPreview;
  /** WebAR GPU frames only — CSS fallback covers warming / missing credentials. */
  const showBeautyPreview = beautySelected && !showDeeparPreview && trtcOutputReady;

  // Instant CSS beauty on the raw camera until WebAR frames paint (matches Create Room).
  // Effects-only (beautyId none) still gets a natural look so go-live never flashes raw face.
  const beautyCssFilter = useMemo(() => {
    if (!beautySelected || showDeeparPreview || trtcOutputReady) return null;
    return getBeautyVideoFilter(beautyId !== 'none' ? beautyId : 'beauty-natural');
  }, [beautyId, beautySelected, showDeeparPreview, trtcOutputReady]);

  useEffect(() => {
    if (cameraReady && deepar.ready) {
      deepar.reconnectExternalVideo();
    }
  }, [cameraReady, deepar.ready, deepar.reconnectExternalVideo, facingMode]);

  const publishRaw = useCallback((rawTrack: MediaStreamTrack | null) => {
    if (!rawTrack) {
      publishTrackRef.current = null;
      publishSourceRef.current = null;
      setVideoTrack(null);
      return;
    }
    if (publishSourceRef.current === 'raw' && publishTrackRef.current === rawTrack) return;
    publishSourceRef.current = 'raw';
    publishTrackRef.current = rawTrack;
    setVideoTrack(rawTrack);
  }, []);

  const publishCanvas = useCallback((canvasTrack: MediaStreamTrack | null) => {
    if (!canvasTrack) return;
    const prepared = prepareProcessedVideoTrackForLiveKit(canvasTrack);
    if (publishSourceRef.current === 'canvas' && publishTrackRef.current === prepared) return;
    publishSourceRef.current = 'canvas';
    publishTrackRef.current = prepared;
    setVideoTrack(prepared);
  }, []);

  const publishBeauty = useCallback((beautyTrack: MediaStreamTrack | null) => {
    if (!beautyTrack) return;
    const prepared = prepareProcessedVideoTrackForLiveKit(beautyTrack);
    if (publishSourceRef.current === 'beauty' && publishTrackRef.current === prepared) return;
    publishSourceRef.current = 'beauty';
    publishTrackRef.current = prepared;
    setVideoTrack(prepared);
  }, []);

  useEffect(() => {
    if (!enabled || !cameraReady) {
      publishTrackRef.current = null;
      publishSourceRef.current = null;
      setVideoTrack(null);
      return undefined;
    }

    const rawTrack =
      inputStream?.getVideoTracks()[0] ??
      camera.streamRef.current?.getVideoTracks()[0] ??
      null;

    if (inputTrackId && inputTrackId !== inputTrackIdRef.current) {
      inputTrackIdRef.current = inputTrackId;
      publishTrackRef.current = null;
      publishSourceRef.current = null;
    }

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

    // Effects on → publish processed; otherwise publish raw for low-latency live.
    if (beautySelected && trtcOutputReady) {
      const beautyTrack =
        beauty.outputStreamRef.current?.getVideoTracks()[0] ??
        beauty.outputStream?.getVideoTracks()[0] ??
        null;
      if (beautyTrack) {
        publishBeauty(beautyTrack);
        return undefined;
      }
    }

    publishRaw(rawTrack);
    return undefined;
  }, [
    beauty.outputStream,
    beauty.outputStreamRef,
    beauty.ready,
    beautySelected,
    beautyVideoReady,
    trtcOutputReady,
    camera.streamRef,
    cameraReady,
    deepar.getCanvasStream,
    deepar.ready,
    effectSelected,
    enabled,
    inputStream,
    inputTrackId,
    publishBeauty,
    publishCanvas,
    publishRaw,
  ]);

  return {
    videoTrack,
    rawVideoRef: camera.videoRef,
    previewRef,
    beautyVideoRef: beauty.outputVideoRef,
    configured,
    cameraReady,
    cameraError: camera.error,
    cameraPermissionDenied: camera.permissionDenied,
    retryCamera: camera.retry,
    cameraFacingMode: facingMode,
    toggleCameraFacing,
    arActive: effectSelected,
    arReady: deepar.ready,
    arLoading: deepar.loading,
    showDeeparPreview,
    beautyConfigured,
    beautyReady: beauty.ready,
    beautyLoading: beauty.loading,
    beautyError: beauty.error,
    showBeautyPreview,
    showProcessedPreview,
    beautyVideoReady,
    beautyCssFilter,
    beautyOutputStream,
    beautyCatalogs: beauty.catalogs,
    readyEffectIds: beauty.readyEffectIds,
  };
}

export { isTencentWebARConfigured as isLiveTrtcConfigured };

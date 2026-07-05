import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useCameraStream, type CameraFacingMode } from '../../lib/deepar/useCameraStream';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import {
  deeparSelectionActive,
  deeparSelectionFromEffectId,
  EMPTY_DEEPAR_EFFECT_SELECTION,
  type DeepAREffectSelection,
} from '../../lib/deepar/deeparEffectSelection';
import { useDeepAR } from '../../lib/deepar/useDeepAR';
import {
  getBeautyVideoFilter,
  getTencentBeautifyParams,
  type BeautyPresetId,
} from '../../lib/ar/beautyFilters';
import { isBodyShapeActive, type BodyShapeParams } from '../../lib/ar/bodyShape';
import { useVideoFrameReady } from '../../lib/camera/useVideoFrameReady';
import { isTencentWebARConfigured } from '../../lib/webar/webarConfig';
import { useTencentWebAR } from '../../lib/webar/useTencentWebAR';
import type { TencentEffectItem, TencentEffectSelection } from '../../lib/webar/webarTypes';
import { EMPTY_BODY_SHAPE, EMPTY_TENCENT_EFFECT_SELECTION } from '../../lib/webar/webarTypes';
import { LIVE_VIDEO_HEIGHT, LIVE_VIDEO_WIDTH, WEBAR_CAMERA_FRAME_RATE, WEBAR_CAMERA_IDEAL } from './liveVideoConstants';
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
  };
};

/**
 * Live camera + DeepAR + Tencent WebAR beauty for Multi-Guest / Solo Live.
 * Publish priority: DeepAR canvas → Tencent beauty output → raw camera.
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
      beautyEffects.backgroundUrl,
  );
  const shapeActive = isBodyShapeActive(bodyShape);
  const beautySelected = beautyId !== 'none' || beautyEffectsActive || shapeActive;
  const webarWarm = beautySelected || beautyPanelOpen;
  const deeparWarm = effectSelected || effectsPanelOpen;
  /** DeepAR effects use native capture resolution — avoid 720p bump (prevents zoom mismatch). */
  const useBeautyCapture = webarWarm && !deeparWarm;

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
    videoIdeal: useBeautyCapture ? WEBAR_CAMERA_IDEAL : { width: LIVE_VIDEO_WIDTH, height: LIVE_VIDEO_HEIGHT },
    frameRate: WEBAR_CAMERA_FRAME_RATE,
  });

  const cameraReady = camera.ready;

  useEffect(() => {
    if (!enabled || !cameraReady) {
      setInputStream(null);
      return;
    }
    setInputStream(camera.streamRef.current);
  }, [camera.streamRef, cameraReady, enabled, facingMode]);

  const beautifyParams = useMemo(
    () => getTencentBeautifyParams(beautyId, bodyShape),
    [beautyId, JSON.stringify(bodyShape)],
  );
  const webar = useTencentWebAR({
    /** Raw camera stays native until beauty is selected or panel opens. */
    enabled: enabled && cameraReady && beautyConfigured && webarWarm,
    inputStream,
    mirror: mirrorSelf,
    beautify: beautifyParams,
    effects: beautyEffects,
    loadCatalogs: beautyPanelOpen || beautySelected,
  });

  const deepar = useDeepAR({
    previewRef,
    videoElementRef: camera.videoRef,
    enabled: enabled && cameraReady && configured && deeparWarm,
    processingActive: effectSelected,
    effectSelection: selection,
    initialEffectId: effectId,
    mirror: mirrorSelf,
    bodyShape,
  });

  const beautyVideoReady = useVideoFrameReady(
    webar.outputVideoRef,
    enabled && cameraReady && beautyConfigured,
  );

  const showDeeparPreview = effectSelected && deepar.ready;
  const showBeautyPreview =
    beautySelected &&
    !showDeeparPreview &&
    beautyVideoReady &&
    (webar.beautyActive || (!beautyConfigured && Boolean(getBeautyVideoFilter(beautyId))));
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

    if (beautySelected && webar.ready) {
      const beautyTrack = webar.outputStreamRef.current?.getVideoTracks()[0] ?? null;
      if (beautyTrack && webar.beautyActive && beautyVideoReady) {
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
  };
}

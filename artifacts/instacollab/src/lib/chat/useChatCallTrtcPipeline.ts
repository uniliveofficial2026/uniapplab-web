/**
 * TRTC + DeepAR camera pipeline for chat video calls.
 * LiveKit carries media; TRTC WebAR processes local video before publish.
 * UI shells (ChatCallVideoEffectsHost) stay design-only — logic lives here.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { useStreamBeauty } from '../ar/useStreamBeauty';
import type { BeautyPresetId } from '../ar/beautyFilters';
import {
  EMPTY_BODY_SHAPE,
  BODY_SHAPE_COMING_SOON,
  isBodyShapeActive,
  type BodyShapeParams,
} from '../ar/bodyShape';
import { readLastVideoCallBeauty, stashLastVideoCallBeauty } from '../ar/lastVideoCallBeauty';
import { subscribeAppCamera } from '../camera/appCameraOwner';
import { isLiveVideoStream } from '../camera/trtcCameraPipeline';
import { useVideoFrameReady } from '../camera/useVideoFrameReady';
import { isDeepARConfigured } from '../deepar/deeparConfig';
import { useDeepAR } from '../deepar/useDeepAR';
import { prepareProcessedVideoTrackForLiveKit } from '../livekit/liveKitVideoPublish';
import { isTencentWebARConfigured, warmTencentWebARPipelineNow } from '../webar/useTencentWebAR';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentEffectSelection,
} from '../webar/webarTypes';

export type ChatCallTrtcPipelineState = {
  beautyId: BeautyPresetId;
  beautyEffects: TencentEffectSelection;
  bodyShape: BodyShapeParams;
  beautyPanelOpen: boolean;
  deeparEffectId: string;
  deeparPanelOpen: boolean;
  beautyActive: boolean;
  deeparActive: boolean;
  deeparLicensed: boolean;
  beautyConfigured: boolean;
  beautyWarm: boolean;
  beautyLoading: boolean;
  deeparLoading: boolean;
  beautyVideoReady: boolean;
  beautyOutputStream: MediaStream | null;
  beautyOutputVideoRef: RefObject<HTMLVideoElement | null>;
  readyEffectIds: string[];
  mirrorLocalPreview: boolean;
  deeparPreviewHostRef: RefObject<HTMLDivElement | null>;
  showBeautyPreview: boolean;
  showDeeparPreview: boolean;
  showProcessedPreview: boolean;
  localPreviewStream: MediaStream | null;
  beautyCatalogs: ReturnType<typeof useStreamBeauty>['catalogs'];
  beautyConfiguredFlag: boolean;
  beautyError: string | null;
  handleSelectDeepAR: (effectId: string) => void;
  handleSelectBeauty: (nextBeautyId: BeautyPresetId) => void;
  handleBeautyEffectsChange: (effects: TencentEffectSelection) => void;
  handleBodyShapeChange: (bodyShape: BodyShapeParams) => void;
  toggleDeeparPanel: () => void;
  closeDeeparPanel: () => void;
  toggleBeautyPanel: () => void;
  closeBeautyPanel: () => void;
  resolveLocalDisplayStream: (
    isCameraEnabled: boolean,
    localVideoStream: MediaStream | null,
  ) => MediaStream | null;
};

type UseChatCallTrtcPipelineOptions = {
  active: boolean;
  mirrorLocalPreview: boolean;
  localVideoStream: MediaStream | null;
  localStreamRef: MutableRefObject<MediaStream | null>;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  onReplaceVideoTrack: (track: MediaStreamTrack | null) => void;
};

export function useChatCallTrtcPipeline({
  active,
  mirrorLocalPreview,
  localVideoStream,
  localStreamRef,
  localVideoRef,
  onReplaceVideoTrack,
}: UseChatCallTrtcPipelineOptions): ChatCallTrtcPipelineState {
  const lastCallBeauty = readLastVideoCallBeauty();
  const [beautyId, setBeautyId] = useState<BeautyPresetId>(
    () => lastCallBeauty?.beautyId ?? 'none',
  );
  const [beautyEffects, setBeautyEffects] = useState<TencentEffectSelection>(
    () => lastCallBeauty?.beautyEffects ?? EMPTY_TENCENT_EFFECT_SELECTION,
  );
  const [bodyShape, setBodyShape] = useState<BodyShapeParams>(
    () => lastCallBeauty?.bodyShape ?? EMPTY_BODY_SHAPE,
  );
  const [deeparEffectId, setDeeparEffectId] = useState('none');
  const [deeparPanelOpen, setDeeparPanelOpen] = useState(false);
  const [beautyPanelOpen, setBeautyPanelOpen] = useState(false);
  const [inputStream, setInputStream] = useState<MediaStream | null>(null);
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null);
  const deeparHostRef = useRef<HTMLDivElement>(null);
  const publishTrackRef = useRef<MediaStreamTrack | null>(null);
  const publishSourceRef = useRef<'raw' | 'canvas' | 'beauty' | null>(null);
  const inputTrackIdRef = useRef('');

  const inputTrackId = inputStream?.getVideoTracks()[0]?.id ?? '';
  const deeparLicensed = isDeepARConfigured();
  const beautyConfigured = isTencentWebARConfigured();
  const deeparActive = deeparLicensed && !beautyConfigured && deeparEffectId !== 'none';
  const beautyEffectsActive = Boolean(
    beautyEffects.makeupId ||
      beautyEffects.stickerId ||
      beautyEffects.filterId ||
      beautyEffects.backgroundUrl ||
      beautyEffects.shapeEffectId,
  );
  const shapeActive = !BODY_SHAPE_COMING_SOON && isBodyShapeActive(bodyShape);
  const beautyActive = beautyId !== 'none' || beautyEffectsActive || shapeActive;

  useEffect(() => {
    if (!active) return;
    stashLastVideoCallBeauty({ beautyId, beautyEffects, bodyShape });
  }, [active, beautyId, beautyEffects, bodyShape]);

  useEffect(() => {
    if (active && beautyConfigured) warmTencentWebARPipelineNow();
  }, [active, beautyConfigured]);

  useEffect(() => {
    if (!active) {
      setInputStream(null);
      return undefined;
    }

    const syncInput = (next?: MediaStream | null) => {
      const candidate = next ?? localStreamRef.current ?? localVideoStream ?? null;
      if (isLiveVideoStream(candidate)) {
        setInputStream(candidate);
      }
    };

    syncInput();
    const unsub = subscribeAppCamera((shared) => {
      if (shared) syncInput(shared);
    }, false);

    return unsub;
  }, [active, localStreamRef, localVideoStream, inputTrackId]);

  useEffect(() => {
    if (active && inputStream && beautyConfigured) warmTencentWebARPipelineNow();
  }, [active, beautyConfigured, inputStream]);

  const beauty = useStreamBeauty({
    enabled: active && beautyConfigured,
    keepWarm: active && beautyConfigured && (beautyActive || beautyPanelOpen),
    inputStream,
    beautyId,
    effects: beautyEffects,
    bodyShape: BODY_SHAPE_COMING_SOON ? undefined : bodyShape,
    mirror: false,
    beautyPanelOpen: active && beautyPanelOpen,
    loadCatalogs: active && beautyConfigured && (beautyPanelOpen || beautyActive),
    persistent: active && beautyConfigured && beautyActive,
  });

  const beautyVideoReady = useVideoFrameReady(
    beauty.outputVideoRef,
    active && beautyConfigured && beautyActive && beauty.ready,
  );

  const beautyOutputStream =
    beauty.outputStream ?? beauty.outputStreamRef.current ?? null;

  const beautyTrackLive = Boolean(
    beautyOutputStream?.getVideoTracks().some((t) => t.readyState === 'live'),
  );

  /** Beauty GPU output — prefer live track; frame gate is only a soft preview hint. */
  const trtcOutputReady =
    active &&
    beautyConfigured &&
    beautyActive &&
    beauty.ready &&
    !deeparActive &&
    (beautyTrackLive || beautyVideoReady) &&
    Boolean(beautyOutputStream);

  const deepar = useDeepAR({
    previewRef: deeparHostRef,
    videoElementRef: localVideoRef,
    // Never warm DeepAR alongside TRTC beauty — dual GPU freezes + blanks the call.
    enabled:
      active &&
      deeparLicensed &&
      !beautyConfigured &&
      (deeparActive || deeparPanelOpen),
    processingActive: deeparActive || deeparPanelOpen,
    initialEffectId: deeparEffectId,
    mirror: true,
  });

  const publishRawTrack = useCallback(
    (track: MediaStreamTrack | null) => {
      if (!track) {
        publishTrackRef.current = null;
        publishSourceRef.current = null;
        setLocalPreviewStream(null);
        void onReplaceVideoTrack(null);
        return;
      }
      if (publishSourceRef.current === 'raw' && publishTrackRef.current?.id === track.id) return;
      publishSourceRef.current = 'raw';
      publishTrackRef.current = track;
      setLocalPreviewStream(new MediaStream([track]));
      void onReplaceVideoTrack(track);
    },
    [onReplaceVideoTrack],
  );

  const publishBeautyTrack = useCallback(
    (track: MediaStreamTrack | null) => {
      if (!track) return;
      const prepared = prepareProcessedVideoTrackForLiveKit(track);
      if (publishSourceRef.current === 'beauty' && publishTrackRef.current?.id === prepared.id) return;
      publishSourceRef.current = 'beauty';
      publishTrackRef.current = prepared;
      setLocalPreviewStream(new MediaStream([prepared]));
      void onReplaceVideoTrack(prepared);
    },
    [onReplaceVideoTrack],
  );

  const publishCanvasTrack = useCallback(
    (track: MediaStreamTrack | null) => {
      if (!track) return;
      const prepared = prepareProcessedVideoTrackForLiveKit(track);
      if (publishSourceRef.current === 'canvas' && publishTrackRef.current?.id === prepared.id) return;
      publishSourceRef.current = 'canvas';
      publishTrackRef.current = prepared;
      setLocalPreviewStream(new MediaStream([prepared]));
      void onReplaceVideoTrack(prepared);
    },
    [onReplaceVideoTrack],
  );

  useEffect(() => {
    if (!active) {
      publishTrackRef.current = null;
      publishSourceRef.current = null;
      setLocalPreviewStream(null);
      return undefined;
    }

    const rawTrack =
      inputStream?.getVideoTracks()[0] ??
      localStreamRef.current?.getVideoTracks()[0] ??
      localVideoStream?.getVideoTracks()[0] ??
      null;

    if (inputTrackId && inputTrackId !== inputTrackIdRef.current) {
      inputTrackIdRef.current = inputTrackId;
      publishTrackRef.current = null;
      publishSourceRef.current = null;
    }

    if (deeparActive && deepar.ready) {
      let cancelled = false;
      let rafId = 0;
      const attach = () => {
        if (cancelled) return;
        const canvasStream = deepar.getCanvasStream(30);
        const track = canvasStream?.getVideoTracks()[0] ?? null;
        if (track) {
          publishCanvasTrack(track);
          return;
        }
        rafId = requestAnimationFrame(attach);
      };
      attach();
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
      };
    }

    if (beautyActive && trtcOutputReady) {
      const beautyTrack =
        beauty.outputStreamRef.current?.getVideoTracks()[0] ??
        beauty.outputStream?.getVideoTracks()[0] ??
        null;
      if (beautyTrack) {
        publishBeautyTrack(beautyTrack);
        return undefined;
      }
    }

    publishRawTrack(rawTrack);
    return undefined;
  }, [
    active,
    beauty.outputStream,
    beauty.outputStreamRef,
    beauty.ready,
    beautyActive,
    beautyVideoReady,
    trtcOutputReady,
    deepar.getCanvasStream,
    deepar.ready,
    deeparActive,
    inputStream,
    inputTrackId,
    localStreamRef,
    localVideoStream,
    publishBeautyTrack,
    publishCanvasTrack,
    publishRawTrack,
  ]);

  const handleSelectDeepAR = useCallback((effectId: string) => {
    setDeeparEffectId(effectId);
    if (effectId !== 'none') {
      setBeautyId('none');
      setBeautyEffects(EMPTY_TENCENT_EFFECT_SELECTION);
    }
  }, []);

  const handleSelectBeauty = useCallback((nextBeautyId: BeautyPresetId) => {
    setBeautyId(nextBeautyId);
    if (nextBeautyId !== 'none') setDeeparEffectId('none');
  }, []);

  const handleBeautyEffectsChange = useCallback((effects: TencentEffectSelection) => {
    setBeautyEffects(effects);
    const hasEffect = Boolean(
      effects.makeupId ||
        effects.stickerId ||
        effects.filterId ||
        effects.backgroundUrl ||
        effects.shapeEffectId,
    );
    if (hasEffect) {
      setDeeparEffectId('none');
      setBeautyPanelOpen(true);
    }
  }, []);

  const handleBodyShapeChange = useCallback((next: BodyShapeParams) => {
    setBodyShape(next);
  }, []);

  const toggleDeeparPanel = useCallback(() => {
    setDeeparPanelOpen((open) => {
      const next = !open;
      if (next) setBeautyPanelOpen(false);
      return next;
    });
  }, []);

  const closeDeeparPanel = useCallback(() => {
    setDeeparPanelOpen(false);
  }, []);

  const toggleBeautyPanel = useCallback(() => {
    setBeautyPanelOpen((open) => {
      const next = !open;
      if (next) setDeeparPanelOpen(false);
      return next;
    });
  }, []);

  const closeBeautyPanel = useCallback(() => {
    setBeautyPanelOpen(false);
  }, []);

  const showDeeparPreview = deeparActive && deepar.ready;
  const showProcessedPreview = (beautyActive && trtcOutputReady) || showDeeparPreview;
  const showBeautyPreview = beautyActive && trtcOutputReady;

  const resolveLocalDisplayStream = useCallback(
    (isCameraEnabled: boolean, rawStream: MediaStream | null) => {
      if (!isCameraEnabled) return null;
      if (beautyActive && trtcOutputReady && beautyOutputStream) return beautyOutputStream;
      if (showDeeparPreview && localPreviewStream) return localPreviewStream;
      return rawStream;
    },
    [
      beautyActive,
      beautyOutputStream,
      localPreviewStream,
      showDeeparPreview,
      trtcOutputReady,
    ],
  );

  return {
    beautyId,
    beautyEffects,
    bodyShape,
    beautyPanelOpen,
    deeparEffectId,
    deeparPanelOpen,
    beautyActive,
    deeparActive,
    deeparLicensed,
    beautyConfigured,
    beautyWarm: beauty.ready,
    beautyLoading: beauty.loading,
    deeparLoading: deepar.loading,
    beautyVideoReady,
    beautyOutputStream,
    beautyOutputVideoRef: beauty.outputVideoRef,
    readyEffectIds: beauty.readyEffectIds,
    mirrorLocalPreview,
    deeparPreviewHostRef: deeparHostRef,
    showBeautyPreview,
    showDeeparPreview,
    showProcessedPreview,
    localPreviewStream,
    beautyCatalogs: beauty.catalogs,
    beautyConfiguredFlag: beauty.configured,
    beautyError: beauty.error,
    handleSelectDeepAR,
    handleSelectBeauty,
    handleBeautyEffectsChange,
    handleBodyShapeChange,
    toggleDeeparPanel,
    closeDeeparPanel,
    toggleBeautyPanel,
    closeBeautyPanel,
    resolveLocalDisplayStream,
  };
}

export { isTencentWebARConfigured as isChatCallTrtcConfigured };

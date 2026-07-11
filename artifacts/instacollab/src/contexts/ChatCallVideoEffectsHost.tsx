import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { useStreamBeauty } from '../lib/ar/useStreamBeauty';
import type { BeautyPresetId } from '../lib/ar/beautyFilters';
import { EMPTY_BODY_SHAPE, BODY_SHAPE_COMING_SOON, isBodyShapeActive, type BodyShapeParams } from '../lib/ar/bodyShape';
import { shouldMirrorCameraPreview } from '../lib/camera/cameraMirrorPolicy';
import type { CameraFacingMode } from '../lib/camera/useCameraStream';
import { isDeepARConfigured } from '../lib/deepar/deeparConfig';
import { useDeepAR } from '../lib/deepar/useDeepAR';
import { useVideoFrameReady } from '../lib/camera/useVideoFrameReady';
import { isTencentWebARConfigured, warmTencentWebARForVideoCall } from '../lib/webar/useTencentWebAR';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentEffectSelection,
} from '../lib/webar/webarTypes';
import type { CallPresentation } from '../lib/chat/chatCallKit';
import { prepareProcessedVideoTrackForLiveKit } from '../lib/livekit/liveKitVideoPublish';
import { ChatCallLocalCameraStage } from '../components/messages/ChatCallLocalCameraStage';
import { MultiGuestEffectsSheet } from '../smule-rooms/components/MultiGuestEffectsSheet';
import { LiveBeautySheet } from '../smule-rooms/components/LiveBeautySheet';
import { readLastVideoCallBeauty, stashLastVideoCallBeauty } from '../lib/ar/lastVideoCallBeauty';

export type ChatCallVideoEffectsValue = {
  beautyId: BeautyPresetId;
  beautyEffects: TencentEffectSelection;
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
  toggleDeeparPanel: () => void;
  toggleBeautyPanel: () => void;
  resolveLocalDisplayStream: (
    isCameraEnabled: boolean,
    localVideoStream: MediaStream | null,
  ) => MediaStream | null;
};

const ChatCallVideoEffectsContext = createContext<ChatCallVideoEffectsValue | null>(null);

export function ChatCallVideoEffectsHost({
  active,
  presentation = 'fullscreen',
  cameraFacingMode = 'user',
  mirrorLocalPreview,
  localVideoStream,
  localStreamRef,
  localVideoRef,
  onReplaceVideoTrack,
  children,
}: {
  active: boolean;
  presentation?: CallPresentation;
  cameraFacingMode?: CameraFacingMode;
  mirrorLocalPreview?: boolean;
  localVideoStream: MediaStream | null;
  localStreamRef: MutableRefObject<MediaStream | null>;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  onReplaceVideoTrack: (track: MediaStreamTrack | null) => void;
  children: React.ReactNode;
}) {
  const [beautyId, setBeautyId] = useState<BeautyPresetId>(() => {
    return readLastVideoCallBeauty()?.beautyId ?? 'none';
  });
  const [beautyEffects, setBeautyEffects] = useState<TencentEffectSelection>(() => {
    return readLastVideoCallBeauty()?.beautyEffects ?? EMPTY_TENCENT_EFFECT_SELECTION;
  });
  const [bodyShape, setBodyShape] = useState<BodyShapeParams>(() => {
    return readLastVideoCallBeauty()?.bodyShape ?? EMPTY_BODY_SHAPE;
  });
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
  const mirrorSelf =
    mirrorLocalPreview ?? shouldMirrorCameraPreview(cameraFacingMode);

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
    if (active && beautyConfigured) {
      warmTencentWebARForVideoCall();
    }
  }, [active, beautyConfigured]);

  useEffect(() => {
    if (!active) {
      setInputStream(null);
      return;
    }
    setInputStream(localStreamRef.current ?? localVideoStream ?? null);
  }, [active, localStreamRef, localVideoStream, inputTrackId]);

  const beauty = useStreamBeauty({
    enabled: active && beautyConfigured,
    keepWarm: active && beautyConfigured,
    inputStream,
    beautyId,
    effects: beautyEffects,
    bodyShape: BODY_SHAPE_COMING_SOON ? undefined : bodyShape,
    mirror: mirrorSelf,
    beautyPanelOpen: active && beautyPanelOpen,
    loadCatalogs: active && beautyPanelOpen,
    persistent: active && beautyConfigured,
  });

  const beautyVideoReady = useVideoFrameReady(
    beauty.outputVideoRef,
    active && beautyConfigured && beauty.ready,
  );

  const beautyOutputStream =
    beauty.outputStream ?? beauty.outputStreamRef.current ?? null;

  /** TRTC warm path — one stable orientation (no raw↔beauty mirror flip). */
  const trtcPreviewReady =
    active &&
    beautyConfigured &&
    beauty.ready &&
    beautyVideoReady &&
    !deeparActive &&
    Boolean(beautyOutputStream);

  const deepar = useDeepAR({
    previewRef: deeparHostRef,
    videoElementRef: localVideoRef,
    enabled: active && deeparLicensed,
    processingActive: deeparActive || deeparPanelOpen,
    initialEffectId: deeparEffectId,
    mirror: true,
  });

  const publishRawTrack = useCallback(
    (track: MediaStreamTrack | null) => {
      if (!track) return;
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

    if (trtcPreviewReady) {
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
    beauty.active,
    beauty.outputStream,
    beauty.ready,
    beautyActive,
    beautyVideoReady,
    trtcPreviewReady,
    deepar.getCanvasStream,
    deepar.ready,
    deeparActive,
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

  const toggleDeeparPanel = useCallback(() => {
    setDeeparPanelOpen((open) => {
      const next = !open;
      if (next) setBeautyPanelOpen(false);
      return next;
    });
  }, []);

  const toggleBeautyPanel = useCallback(() => {
    setBeautyPanelOpen((open) => {
      const next = !open;
      if (next) setDeeparPanelOpen(false);
      return next;
    });
  }, []);

  const showBeautyPreview = beautyActive && trtcPreviewReady;
  const showDeeparPreview = deeparActive && deepar.ready;
  const showProcessedPreview = trtcPreviewReady || showDeeparPreview;

  const resolveLocalDisplayStream = useCallback(
    (isCameraEnabled: boolean, rawStream: MediaStream | null) => {
      if (!isCameraEnabled) return null;
      if (trtcPreviewReady && beautyOutputStream) return beautyOutputStream;
      if (showProcessedPreview && localPreviewStream) return localPreviewStream;
      return rawStream;
    },
    [beautyOutputStream, localPreviewStream, showProcessedPreview, trtcPreviewReady],
  );

  const showFullscreenCamera = active && presentation === 'fullscreen';
  const cameraStream = localStreamRef.current ?? localVideoStream ?? null;

  const value: ChatCallVideoEffectsValue | null = active
    ? {
        beautyId,
        beautyEffects,
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
        mirrorLocalPreview: mirrorSelf,
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
        toggleDeeparPanel,
        toggleBeautyPanel,
        resolveLocalDisplayStream,
      }
    : null;

  return (
    <ChatCallVideoEffectsContext.Provider value={value}>
      {active ? (
        <>
          {showFullscreenCamera ? (
            <div className="fixed inset-0 z-[198]">
              <ChatCallLocalCameraStage
                rawStream={cameraStream}
                beautySinkVideoRef={beauty.outputVideoRef}
                beautyDisplayStream={beautyOutputStream}
                deeparPreviewHostRef={deeparHostRef}
                showBeautyPreview={trtcPreviewReady}
                showDeeparPreview={showDeeparPreview}
                showProcessedPreview={showProcessedPreview}
                layout="fullscreen"
                mirrored={mirrorSelf}
                trtcConfigured={beautyConfigured}
                trtcLoading={beauty.loading && !beauty.ready}
              />
            </div>
          ) : (
            <video
              ref={beauty.outputVideoRef}
              autoPlay
              playsInline
              muted
              aria-hidden
              className="fixed h-px w-px opacity-0 pointer-events-none"
              style={{ left: -9999, top: -9999 }}
            />
          )}
        </>
      ) : null}
      {children}
      {active ? (
        <>
          {deeparLicensed && !beautyConfigured ? (
            <MultiGuestEffectsSheet
              isOpen={deeparPanelOpen}
              onClose={() => setDeeparPanelOpen(false)}
              activeEffectId={deeparEffectId}
              onSelectEffect={(id) => {
                handleSelectDeepAR(id);
                if (id === deeparEffectId) setDeeparPanelOpen(false);
              }}
              loading={deeparActive && deepar.loading}
              cameraReady={Boolean(localVideoStream || localStreamRef.current)}
              anchorBottom={100}
            />
          ) : null}
          <LiveBeautySheet
            isOpen={beautyPanelOpen}
            onClose={() => setBeautyPanelOpen(false)}
            activeBeautyId={beautyId}
            onSelectBeauty={handleSelectBeauty}
            effects={beautyEffects}
            onEffectsChange={handleBeautyEffectsChange}
            bodyShape={bodyShape}
            onBodyShapeChange={setBodyShape}
            catalogs={beauty.catalogs}
            readyEffectIds={beauty.readyEffectIds}
            anchorBottom={beautyPanelOpen ? 8 : 96}
            variant="call"
            webarConfigured={beauty.configured}
            webarLoading={beauty.loading && !beauty.ready}
            webarError={beauty.error}
          />
        </>
      ) : null}
    </ChatCallVideoEffectsContext.Provider>
  );
}

export function useChatCallVideoEffects(): ChatCallVideoEffectsValue {
  const ctx = useContext(ChatCallVideoEffectsContext);
  if (!ctx) {
    throw new Error('useChatCallVideoEffects requires an active video call effects host');
  }
  return ctx;
}

export function useOptionalChatCallVideoEffects(): ChatCallVideoEffectsValue | null {
  return useContext(ChatCallVideoEffectsContext);
}

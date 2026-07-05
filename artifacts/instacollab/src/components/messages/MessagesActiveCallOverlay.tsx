import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, Video, Mic, PhoneOff } from 'lucide-react';
import { motion } from 'motion/react';
import type { MutableRefObject, RefObject } from 'react';
import type { ChatGroup, User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import type { ChatCallKind, ChatCallPhase } from '../../lib/chat/useChatCall';
import { useStreamBeauty } from '../../lib/ar/useStreamBeauty';
import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { useDeepAR } from '../../lib/deepar/useDeepAR';
import { CameraDualBeautyButtons } from '../camera/CameraDualBeautyButtons';
import { MultiGuestEffectsSheet } from '../../smule-rooms/components/MultiGuestEffectsSheet';
import { LiveBeautySheet } from '../../smule-rooms/components/LiveBeautySheet';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentEffectSelection,
} from '../../lib/webar/webarTypes';

type MessagesActiveCallOverlayProps = {
  activeCall: ChatCallKind;
  phase: ChatCallPhase;
  selectedUser: User | ChatGroup;
  currentUserAvatarUrl?: string;
  error?: string | null;
  remoteVideoReady?: boolean;
  localVideoRef?: RefObject<HTMLVideoElement | null>;
  remoteVideoRef?: RefObject<HTMLVideoElement | null>;
  remoteAudioRef?: RefObject<HTMLAudioElement | null>;
  localStreamRef?: MutableRefObject<MediaStream | null>;
  onReplaceVideoTrack?: (track: MediaStreamTrack | null) => void;
  onAccept?: () => void;
  onEndCall: () => void;
};

export function MessagesActiveCallOverlay({
  activeCall,
  phase,
  selectedUser,
  currentUserAvatarUrl,
  error,
  remoteVideoReady,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  localStreamRef,
  onReplaceVideoTrack,
  onAccept,
  onEndCall,
}: MessagesActiveCallOverlayProps) {
  const videoCall = activeCall === 'video';
  const inCall = phase === 'outgoing' || phase === 'connected' || phase === 'incoming';
  const [beautyId, setBeautyId] = useState<BeautyPresetId>('none');
  const [beautyEffects, setBeautyEffects] = useState<TencentEffectSelection>(
    EMPTY_TENCENT_EFFECT_SELECTION,
  );
  const [deeparEffectId, setDeeparEffectId] = useState('none');
  const [deeparPanelOpen, setDeeparPanelOpen] = useState(false);
  const [beautyPanelOpen, setBeautyPanelOpen] = useState(false);
  const [inputStream, setInputStream] = useState<MediaStream | null>(null);
  const deeparPreviewRef = useRef<HTMLDivElement>(null);
  const deeparLicensed = isDeepARConfigured();
  const deeparActive = deeparLicensed && deeparEffectId !== 'none';
  const beautyEffectsActive = Boolean(
    beautyEffects.makeupId ||
      beautyEffects.stickerId ||
      beautyEffects.filterId ||
      beautyEffects.backgroundUrl,
  );
  const beautyActive = beautyId !== 'none' || beautyEffectsActive;

  useEffect(() => {
    if (!videoCall || !inCall) {
      setInputStream(null);
      return;
    }
    const sync = () => {
      setInputStream(localStreamRef?.current ?? null);
    };
    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, [videoCall, inCall, localStreamRef, phase]);

  const beauty = useStreamBeauty({
    enabled: videoCall && inCall && phase !== 'incoming' && !deeparActive,
    inputStream,
    beautyId,
    effects: beautyEffects,
    mirror: true,
  });

  const deepar = useDeepAR({
    previewRef: deeparPreviewRef,
    videoElementRef: localVideoRef ?? { current: null },
    enabled: videoCall && inCall && phase !== 'incoming' && deeparLicensed,
    processingActive: deeparActive,
    initialEffectId: deeparEffectId,
    mirror: true,
  });

  useEffect(() => {
    if (!videoCall || !onReplaceVideoTrack || phase === 'incoming') return;

    if (deeparActive && deepar.ready) {
      let cancelled = false;
      let rafId = 0;
      const attach = () => {
        if (cancelled) return;
        const canvasStream = deepar.getCanvasStream(30);
        const track = canvasStream?.getVideoTracks()[0] ?? null;
        if (track) {
          void onReplaceVideoTrack(track);
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

    if (beauty.active && beauty.outputStream) {
      const track = beauty.outputStream.getVideoTracks()[0] ?? null;
      void onReplaceVideoTrack(track);
      return;
    }

    const raw = localStreamRef?.current?.getVideoTracks()[0] ?? null;
    if (raw) void onReplaceVideoTrack(raw);
  }, [
    beauty.active,
    beauty.outputStream,
    deepar.ready,
    deepar.getCanvasStream,
    deeparActive,
    videoCall,
    onReplaceVideoTrack,
    localStreamRef,
    phase,
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
    if (nextBeautyId !== 'none') {
      setDeeparEffectId('none');
    }
  }, []);

  const handleBeautyEffectsChange = useCallback((effects: TencentEffectSelection) => {
    setBeautyEffects(effects);
    const active = Boolean(
      effects.makeupId || effects.stickerId || effects.filterId || effects.backgroundUrl,
    );
    if (active) setDeeparEffectId('none');
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

  const showProcessedPreview = (deeparActive && deepar.ready) || beauty.active;

  const statusLabel =
    phase === 'incoming'
      ? `Incoming ${activeCall} call…`
      : phase === 'connected'
        ? activeCall === 'video'
          ? 'Video connected'
          : 'Audio connected'
        : activeCall === 'video'
          ? 'Your camera is ready — connecting…'
          : 'Your mic is ready — connecting…';

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[200] flex flex-col pt-12 pb-8 px-4 items-center justify-between">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {activeCall === 'video' && phase === 'connected' ? (
        <div className="absolute inset-0 bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${remoteVideoReady ? 'opacity-100' : 'opacity-0'}`}
          />
          {!remoteVideoReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <img
                src={selectedUser.avatarUrl || undefined}
                alt=""
                className="w-28 h-28 rounded-full object-cover border-4 border-white/20"
                onError={handleAvatarError}
              />
              <p className="text-sm text-white/80 animate-pulse">Waiting for video…</p>
            </div>
          )}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`absolute bottom-32 right-6 w-28 h-40 rounded-xl border border-white/30 object-cover shadow-2xl bg-secondary ${
              showProcessedPreview ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          />
          <video
            ref={beauty.outputVideoRef}
            autoPlay
            playsInline
            muted
            className={`absolute bottom-32 right-6 w-28 h-40 rounded-xl border border-white/30 object-cover shadow-2xl bg-secondary ${
              beauty.active && !deeparActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
          <div
            ref={deeparPreviewRef}
            className={`absolute bottom-32 right-6 w-28 h-40 rounded-xl border border-white/30 overflow-hidden shadow-2xl ${
              deeparActive && deepar.ready ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex flex-col items-center gap-4 text-center mt-12 relative z-10"
        >
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-xl">
            <img
              src={selectedUser.avatarUrl || undefined}
              alt="avatar"
              className="w-full h-full object-cover"
              onError={handleAvatarError}
            />
          </div>
          <h2 className="text-2xl font-bold">{selectedUser.displayName}</h2>
          <p className="text-muted-foreground animate-pulse">{statusLabel}</p>
          {error ? <p className="text-sm text-red-500 max-w-xs">{error}</p> : null}
        </motion.div>
      )}

      {activeCall === 'video' && phase !== 'connected' && phase !== 'incoming' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="absolute bottom-32 right-8 w-28 h-40 bg-secondary rounded-xl border border-border shadow-2xl overflow-hidden flex items-center justify-center z-10"
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${showProcessedPreview ? 'opacity-0' : 'opacity-100'}`}
          />
          <video
            ref={beauty.outputVideoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${
              beauty.active && !deeparActive ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            ref={deeparPreviewRef}
            className={`absolute inset-0 ${
              deeparActive && deepar.ready ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
          {!localVideoRef?.current?.srcObject && !showProcessedPreview && (
            <img
              src={currentUserAvatarUrl || undefined}
              className="absolute inset-0 w-full h-full object-cover opacity-80"
              alt="you"
              onError={handleAvatarError}
            />
          )}
        </motion.div>
      )}

      {activeCall === 'video' && phase !== 'incoming' ? (
        <div className="relative z-20 mb-3 flex w-full max-w-md flex-col items-center gap-2">
          <CameraDualBeautyButtons
            variant="inline"
            deeparPanelOpen={deeparPanelOpen}
            beautyPanelOpen={beautyPanelOpen}
            deeparActive={deeparActive}
            beautyActive={beautyActive}
            onToggleDeepAR={toggleDeeparPanel}
            onToggleBeauty={toggleBeautyPanel}
            showDeepAR={deeparLicensed}
            showBeauty
          />

          {(beauty.loading || (deeparActive && deepar.loading)) ? (
            <p className="text-[10px] font-bold text-white/70">Loading effects…</p>
          ) : null}
        </div>
      ) : null}

      {activeCall === 'video' && phase !== 'incoming' && deeparLicensed ? (
        <MultiGuestEffectsSheet
          isOpen={deeparPanelOpen}
          onClose={() => setDeeparPanelOpen(false)}
          activeEffectId={deeparEffectId}
          onSelectEffect={(id) => {
            handleSelectDeepAR(id);
            if (id === deeparEffectId) setDeeparPanelOpen(false);
          }}
          loading={deeparActive && deepar.loading}
          cameraReady={Boolean(localStreamRef?.current)}
          anchorBottom={120}
        />
      ) : null}
      {activeCall === 'video' && phase !== 'incoming' ? (
        <LiveBeautySheet
          isOpen={beautyPanelOpen}
          onClose={() => setBeautyPanelOpen(false)}
          activeBeautyId={beautyId}
          onSelectBeauty={handleSelectBeauty}
          effects={beautyEffects}
          onEffectsChange={handleBeautyEffectsChange}
          catalogs={beauty.catalogs}
          anchorBottom={120}
          webarConfigured={beauty.configured}
          webarLoading={beauty.loading}
          webarError={beauty.error}
        />
      ) : null}

      <div className="relative z-20 flex items-center gap-6">
        {phase === 'incoming' && onAccept ? (
          <button
            type="button"
            onClick={onAccept}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
            aria-label="Accept call"
          >
            {activeCall === 'video' ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
          </button>
        ) : null}
        <button
          type="button"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white"
          aria-label="Microphone"
        >
          <Mic className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={onEndCall}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg"
          aria-label="End call"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

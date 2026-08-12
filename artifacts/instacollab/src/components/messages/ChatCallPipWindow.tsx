import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, GripVertical } from 'lucide-react';
import { motion } from 'motion/react';
import type { ChatGroup, User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import { useOptionalChatCallVideoEffects } from '../../contexts/ChatCallVideoEffectsHost';
import type {
  ChatCallKind,
  ChatConnectPhase,
  RemoteCallVideo,
  RemoteCallParticipant,
} from '../../lib/chat/chatCallKit';
import { CallVideoSurface } from './CallVideoSurface';
import { ChatCallLocalCameraStage } from './ChatCallLocalCameraStage';
import { ChatCallControls } from './ChatCallControls';
import { AudioCallWaveBars } from './AudioCallWaveBars';

type ChatCallPipWindowProps = {
  activeCall: ChatCallKind;
  connectPhase: ChatConnectPhase;
  selectedUser: User | ChatGroup;
  currentUserAvatarUrl?: string;
  isGroupCall?: boolean;
  remoteVideoReady?: boolean;
  localVideoStream?: MediaStream | null;
  primaryRemoteStream?: MediaStream | null;
  remoteVideos?: RemoteCallVideo[];
  remoteParticipants?: RemoteCallParticipant[];
  isMicMuted?: boolean;
  isCameraEnabled?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onFlipCamera?: () => void;
  onExpand: () => void;
  onEndCall: () => void;
};

const VIDEO_PIP_WIDTH = 180;
const VIDEO_PIP_HEIGHT = 252;
const AUDIO_PIP_WIDTH = 168;
const AUDIO_PIP_HEIGHT = 220;

export function ChatCallPipWindow({
  activeCall,
  connectPhase,
  selectedUser,
  currentUserAvatarUrl,
  isGroupCall = false,
  remoteVideoReady = false,
  localVideoStream = null,
  primaryRemoteStream = null,
  remoteVideos = [],
  remoteParticipants = [],
  isMicMuted = false,
  isCameraEnabled = true,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onExpand,
  onEndCall,
}: ChatCallPipWindowProps) {
  const videoCall = activeCall === 'video';
  const pipWidth = videoCall ? VIDEO_PIP_WIDTH : AUDIO_PIP_WIDTH;
  const pipHeight = videoCall ? VIDEO_PIP_HEIGHT : AUDIO_PIP_HEIGHT;
  const dragRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const fx = useOptionalChatCallVideoEffects();

  const localDisplayStream =
    videoCall && fx
      ? fx.resolveLocalDisplayStream(isCameraEnabled, localVideoStream)
      : isCameraEnabled
        ? localVideoStream
        : null;
  const showDeeparPreview = fx?.showDeeparPreview ?? false;
  const showProcessedPreview = fx?.showProcessedPreview ?? false;
  const mirrorLocalPreview = fx?.mirrorLocalPreview ?? true;

  const [pos, setPos] = useState<{ left: number; top: number }>(() => ({
    left: Math.max(12, window.innerWidth - pipWidth - 16),
    top: Math.max(
      72,
      window.innerHeight -
        pipHeight -
        88 -
        parseInt(getComputedStyle(document.documentElement).getPropertyValue('--app-safe-bottom') || '0', 10),
    ),
  }));

  const hasRemote = videoCall && remoteVideoReady && !!primaryRemoteStream;
  const mainStream = hasRemote ? primaryRemoteStream : localDisplayStream;
  const connectedCount = remoteParticipants.filter((p) => p.hasAudio).length;
  const isConnected = connectPhase === 'idle' || connectPhase === 'connected';
  const showActiveWave = isConnected && !isMicMuted;

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if ((event.target as HTMLElement).closest('[data-pip-action]')) return;
      const el = dragRef.current;
      if (!el) return;
      dragState.current = {
        x: event.clientX,
        y: event.clientY,
        left: pos.left,
        top: pos.top,
      };
      el.setPointerCapture(event.pointerId);
    },
    [pos.left, pos.top],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      const maxLeft = window.innerWidth - pipWidth - 8;
      const maxTop = window.innerHeight - pipHeight - 8;
      setPos({
        left: Math.min(maxLeft, Math.max(8, state.left + (event.clientX - state.x))),
        top: Math.min(maxTop, Math.max(8, state.top + (event.clientY - state.y))),
      });
    },
    [pipWidth, pipHeight],
  );

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    dragState.current = null;
    dragRef.current?.releasePointerCapture(event.pointerId);
  }, []);

  useEffect(() => {
    const clamp = () => {
      setPos((prev) => ({
        left: Math.min(window.innerWidth - pipWidth - 8, Math.max(8, prev.left)),
        top: Math.min(window.innerHeight - pipHeight - 8, Math.max(8, prev.top)),
      }));
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [pipWidth, pipHeight]);

  const statusText =
    connectPhase === 'connecting' || connectPhase === 'slow'
      ? 'Connecting…'
      : connectPhase === 'failed'
        ? 'Reconnect needed'
        : videoCall
          ? hasRemote
            ? 'Video'
            : 'Your camera'
          : isGroupCall && connectedCount > 0
            ? `${connectedCount} in call`
            : 'Audio';

  return (
    <motion.div
      ref={dragRef}
      className="fixed z-[205] touch-none select-none"
      style={{ left: pos.left, top: pos.top, width: pipWidth }}
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="dialog"
      aria-label={`Call with ${selectedUser.displayName} — picture in picture`}
    >
      <div
        className={`overflow-hidden rounded-2xl border shadow-[0_16px_48px_rgba(0,0,0,0.45)] ${
          videoCall
            ? 'border-white/20 bg-[#1c1c1e]'
            : 'border-emerald-400/25 bg-gradient-to-b from-zinc-900 to-zinc-950'
        }`}
      >
        {videoCall ? (
          <div className="relative aspect-[3/4] bg-zinc-900">
            {!hasRemote && isCameraEnabled && localVideoStream ? (
              <ChatCallLocalCameraStage
                rawStream={localVideoStream}
                beautyDisplayStream={fx?.beautyOutputStream}
                deeparPreviewHostRef={fx?.deeparPreviewHostRef}
                showBeautyPreview={showProcessedPreview && !showDeeparPreview}
                showDeeparPreview={showDeeparPreview}
                showProcessedPreview={showProcessedPreview}
                layout="fill"
                mirrored={mirrorLocalPreview}
                trtcConfigured={fx?.beautyConfigured}
                trtcLoading={fx?.beautyLoading}
              />
            ) : mainStream ? (
              <CallVideoSurface
                stream={mainStream}
                mirrored={!hasRemote && mirrorLocalPreview}
                className="h-full w-full object-cover"
                label={hasRemote ? 'Remote video' : 'Your camera'}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
                <img
                  src={selectedUser.avatarUrl || undefined}
                  alt=""
                  className="h-16 w-16 rounded-full border-2 border-white/20 object-cover"
                  onError={handleAvatarError}
                />
              </div>
            )}

            {hasRemote && isCameraEnabled && localDisplayStream ? (
              <CallVideoSurface
                stream={localDisplayStream}
                mirrored={mirrorLocalPreview}
                className="absolute bottom-2 right-2 h-14 w-10 rounded-lg border border-white/30 object-cover bg-black/40 shadow-lg"
                label="Your camera"
              />
            ) : null}

            {isGroupCall && remoteVideos.length > 1 ? (
              <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">
                +{remoteVideos.length - 1} in call
              </span>
            ) : null}

            <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-2 py-1.5">
              <GripVertical className="h-4 w-4 text-white/50" />
              <button
                type="button"
                data-pip-action="expand"
                onClick={onExpand}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
                aria-label="Expand call"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative px-3 pt-2 pb-3">
            <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-2 py-1.5">
              <GripVertical className="h-4 w-4 text-white/40" />
              <button
                type="button"
                data-pip-action="expand"
                onClick={onExpand}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Expand call"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-6 flex flex-col items-center gap-2">
              <div className="relative">
                {isConnected ? (
                  <span className="absolute -inset-1.5 rounded-full bg-emerald-400/20 animate-pulse" />
                ) : null}
                <img
                  src={selectedUser.avatarUrl || undefined}
                  alt=""
                  className={`relative h-16 w-16 rounded-full border-2 object-cover ${
                    isConnected ? 'border-emerald-400/70' : 'border-white/20'
                  }`}
                  onError={handleAvatarError}
                />
                {currentUserAvatarUrl ? (
                  <img
                    src={currentUserAvatarUrl}
                    alt="You"
                    className={`absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-2 object-cover ${
                      isMicMuted ? 'border-red-400' : 'border-blue-400/70'
                    }`}
                    onError={handleAvatarError}
                  />
                ) : null}
              </div>

              <AudioCallWaveBars active={showActiveWave} bars={4} className="h-4" />

              {isGroupCall && connectedCount > 0 ? (
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                  {connectedCount} connected
                </span>
              ) : null}
            </div>
          </div>
        )}

        <div className="space-y-2 px-2.5 py-2">
          <div>
            <p className="truncate text-[12px] font-semibold text-white">{selectedUser.displayName}</p>
            <p className="truncate text-[10px] text-white/50">
              {isGroupCall ? `Group · ${statusText}` : statusText}
            </p>
          </div>
          <ChatCallControls
            compact
            callKind={activeCall}
            isMicMuted={isMicMuted}
            isCameraEnabled={isCameraEnabled}
            onToggleMic={() => void onToggleMic?.()}
            onToggleCamera={() => void onToggleCamera?.()}
            onFlipCamera={videoCall ? () => void onFlipCamera?.() : undefined}
            onEndCall={onEndCall}
          />
        </div>
      </div>
    </motion.div>
  );
}

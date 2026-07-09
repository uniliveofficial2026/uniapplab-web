import { Loader2, Minimize2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { ChatGroup, User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import { useCameraEffectsPanelChrome } from '../../lib/camera/useCameraEffectsPanelChrome';
import type {
  ChatCallKind,
  ChatCallPhase,
  ChatConnectPhase,
  RemoteCallParticipant,
  RemoteCallVideo,
} from '../../lib/chat/chatCallKit';
import { useOptionalChatCallVideoEffects } from '../../contexts/ChatCallVideoEffectsHost';
import { CameraDualBeautyButtons } from '../camera/CameraDualBeautyButtons';
import { CallVideoSurface } from './CallVideoSurface';
import { ChatCallControls } from './ChatCallControls';
import { CallControlsChrome } from './CallControlsChrome';
import { AudioCallStage } from './AudioCallStage';
import { GroupVideoCallStage } from './GroupVideoCallStage';

type MessagesActiveCallOverlayProps = {
  activeCall: ChatCallKind;
  phase: ChatCallPhase;
  connectPhase?: ChatConnectPhase;
  isGroupCall?: boolean;
  selectedUser: User | ChatGroup;
  currentUserAvatarUrl?: string;
  error?: string | null;
  remoteVideoReady?: boolean;
  localVideoStream?: MediaStream | null;
  primaryRemoteStream?: MediaStream | null;
  remoteVideos?: RemoteCallVideo[];
  remoteParticipants?: RemoteCallParticipant[];
  currentUserId?: string | null;
  isMicMuted?: boolean;
  isCameraEnabled?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onFlipCamera?: () => void;
  onRetryConnect?: () => void;
  onMinimize?: () => void;
  onEndCall: () => void;
};

export function MessagesActiveCallOverlay({
  activeCall,
  phase,
  connectPhase = 'idle',
  isGroupCall = false,
  selectedUser,
  currentUserAvatarUrl,
  error,
  remoteVideoReady = false,
  localVideoStream = null,
  primaryRemoteStream = null,
  remoteVideos = [],
  remoteParticipants = [],
  currentUserId = null,
  isMicMuted = false,
  isCameraEnabled = true,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onRetryConnect,
  onMinimize,
  onEndCall,
}: MessagesActiveCallOverlayProps) {
  const videoCall = activeCall === 'video';
  const inCall = phase === 'outgoing' || phase === 'connected';
  const fx = useOptionalChatCallVideoEffects();

  const isGroup = isGroupCall || 'isGroup' in selectedUser;
  const memberCount = isGroup && 'memberIds' in selectedUser ? selectedUser.memberIds?.length : 0;
  const hasRemoteVideo = videoCall && remoteVideoReady && !!primaryRemoteStream;
  const showBeautyPreview = fx?.showBeautyPreview ?? false;
  const showDeeparPreview = fx?.showDeeparPreview ?? false;
  const showProcessedPreview = fx?.showProcessedPreview ?? false;

  const localDisplayStream =
    videoCall && fx
      ? fx.resolveLocalDisplayStream(isCameraEnabled, localVideoStream)
      : isCameraEnabled
        ? localVideoStream
        : null;

  const localCameraLive = Boolean(
    isCameraEnabled &&
      (localDisplayStream ||
        localVideoStream?.getVideoTracks().some((t) => t.readyState === 'live')),
  );

  const showVideoStatusBanner =
    videoCall &&
    inCall &&
    !hasRemoteVideo &&
    !localCameraLive &&
    connectPhase !== 'connected';

  const { controlsVisible, handleStageTap } = useCameraEffectsPanelChrome({
    enabled: videoCall && inCall,
    pinVisible:
      connectPhase === 'connecting' ||
      connectPhase === 'slow' ||
      connectPhase === 'failed' ||
      Boolean(error) ||
      showVideoStatusBanner,
    beautyPanelOpen: fx?.beautyPanelOpen,
    effectsPanelOpen: fx?.deeparPanelOpen,
  });

  const statusLabel =
    phase === 'connected'
      ? activeCall === 'video'
        ? isGroup
          ? 'Group video connected'
          : 'Video connected'
        : isGroup
          ? 'Group audio connected'
          : 'Audio connected'
      : connectPhase === 'slow'
        ? 'Slow connection — still connecting…'
        : connectPhase === 'failed'
          ? 'Could not connect — tap Retry'
          : activeCall === 'video'
            ? 'Connecting…'
            : 'Your mic is ready — connecting…';

  const mirrorLocalPreview = fx?.mirrorLocalPreview ?? true;
  const localTile = (
    <div className="absolute bottom-28 right-4 z-20 h-40 w-28 overflow-hidden rounded-xl border border-white/30 bg-black/40 shadow-2xl sm:bottom-32 sm:right-6">
      {localDisplayStream ? (
        <CallVideoSurface
          stream={localDisplayStream}
          layout="fill"
          framing="wide"
          mirrored={mirrorLocalPreview && !showProcessedPreview}
          label="Your camera"
        />
      ) : (
        <img
          src={currentUserAvatarUrl || undefined}
          alt="You"
          className="h-full w-full object-cover opacity-80"
          onError={handleAvatarError}
        />
      )}
    </div>
  );

  const beautyControls =
    videoCall && fx ? (
      <CameraDualBeautyButtons
        variant="call"
        deeparPanelOpen={fx.deeparPanelOpen}
        beautyPanelOpen={fx.beautyPanelOpen}
        deeparActive={fx.deeparActive}
        beautyActive={fx.beautyActive}
        onToggleDeepAR={fx.toggleDeeparPanel}
        onToggleBeauty={fx.toggleBeautyPanel}
        showDeepAR={fx.deeparLicensed && !fx.beautyConfigured}
        showBeauty={fx.beautyConfigured}
        disabled={!isCameraEnabled}
      />
    ) : null;

  return (
    <div
      className={`fixed inset-0 z-[200] ${
        videoCall && inCall && localCameraLive && !hasRemoteVideo ? 'bg-transparent' : 'bg-black'
      }`}
    >
      {videoCall && inCall ? (
        <>
          <div
            className="absolute inset-0 overflow-hidden"
            onClick={handleStageTap}
            role="presentation"
          >
            {hasRemoteVideo ? (
              isGroup && remoteVideos.length > 0 ? (
                <GroupVideoCallStage
                  remoteVideos={remoteVideos}
                  localStream={localDisplayStream}
                  localLabel="You"
                  localTile={localTile}
                />
              ) : (
                <CallVideoSurface
                  stream={primaryRemoteStream}
                  layout="fullscreen"
                  framing="cover"
                  label={`${selectedUser.displayName} camera`}
                />
              )
            ) : localCameraLive ? (
              <div className="absolute inset-0" aria-hidden />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                <img
                  src={selectedUser.avatarUrl || undefined}
                  alt=""
                  className="h-28 w-28 rounded-full border-4 border-white/20 object-cover"
                  onError={handleAvatarError}
                />
                <p className="animate-pulse text-sm text-white/80">Starting camera…</p>
              </div>
            )}

            {showVideoStatusBanner ? (
              <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--app-safe-top)+3.5rem)] z-20 px-4 text-center">
                <p className="inline-flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
                  {connectPhase === 'connecting' || connectPhase === 'slow' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {statusLabel}
                </p>
              </div>
            ) : null}

            {hasRemoteVideo ? localTile : null}

            {fx?.beautyLoading && fx.beautyPanelOpen ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-40 z-30 text-center">
                <p className="text-[10px] font-bold text-white/70">Loading beauty…</p>
              </div>
            ) : null}
          </div>

          {onMinimize ? (
            <CallControlsChrome
              visible={controlsVisible}
              edge="top"
              className="absolute inset-x-0 top-0 z-40 pt-[var(--app-safe-top)]"
            >
              <div className="pointer-events-auto flex justify-end px-4 py-3">
                <button
                  type="button"
                  onClick={onMinimize}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-colors"
                  aria-label="Minimize to picture in picture"
                >
                  <Minimize2 className="h-5 w-5" />
                </button>
              </div>
            </CallControlsChrome>
          ) : null}

          <CallControlsChrome
            visible={controlsVisible}
            edge="bottom"
            className="absolute inset-x-0 bottom-0 z-30"
          >
            <div className="pointer-events-auto flex justify-center pb-[max(1rem,var(--app-safe-bottom))] pt-3">
              <ChatCallControls
                callKind={activeCall}
                isMicMuted={isMicMuted}
                isCameraEnabled={isCameraEnabled}
                onToggleMic={() => void onToggleMic?.()}
                onToggleCamera={() => void onToggleCamera?.()}
                onFlipCamera={() => void onFlipCamera?.()}
                onEndCall={onEndCall}
                extraBeforeEnd={beautyControls}
              />
            </div>
          </CallControlsChrome>
        </>
      ) : inCall ? (
        <AudioCallStage
          phase={phase}
          connectPhase={connectPhase}
          isGroup={isGroup}
          selectedUser={selectedUser}
          currentUserAvatarUrl={currentUserAvatarUrl}
          currentUserId={currentUserId}
          remoteParticipants={remoteParticipants}
          statusLabel={statusLabel}
          error={error}
          isMicMuted={isMicMuted}
          onRetryConnect={onRetryConnect}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="relative z-10 mt-16 flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center"
        >
          <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-primary shadow-xl">
            <img
              src={selectedUser.avatarUrl || undefined}
              alt="avatar"
              className="h-full w-full object-cover"
              onError={handleAvatarError}
            />
          </div>
          <h2 className="text-2xl font-bold text-white">{selectedUser.displayName}</h2>
          {isGroup && memberCount > 0 ? (
            <p className="text-sm text-white/60">{memberCount} members</p>
          ) : null}
          <p className="flex items-center justify-center gap-2 text-white/70">
            {connectPhase === 'connecting' || connectPhase === 'slow' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {statusLabel}
          </p>
          {error ? <p className="max-w-xs text-sm text-red-400">{error}</p> : null}
          {(connectPhase === 'slow' || connectPhase === 'failed') && onRetryConnect ? (
            <button
              type="button"
              onClick={onRetryConnect}
              className="mt-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Retry connection
            </button>
          ) : null}
        </motion.div>
      )}

      {!videoCall || !inCall ? (
        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center pb-[max(1rem,var(--app-safe-bottom))] pt-3">
          <ChatCallControls
            callKind={activeCall}
            isMicMuted={isMicMuted}
            isCameraEnabled={isCameraEnabled}
            onToggleMic={() => void onToggleMic?.()}
            onToggleCamera={() => void onToggleCamera?.()}
            onFlipCamera={videoCall ? () => void onFlipCamera?.() : undefined}
            onEndCall={onEndCall}
            extraBeforeEnd={beautyControls}
          />
        </div>
      ) : null}
    </div>
  );
}

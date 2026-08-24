import { FlipHorizontal2, Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, WandSparkles } from 'lucide-react';
import type { ChatCallKind } from '../../lib/chat/chatCallKit';
import type { ChatGroup, User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import { CallVideoSurface } from './CallVideoSurface';
import {
  CallBrand,
  CallInfoCard,
  CallRingingAvatar,
  CallRingingWave,
  CreatorIdentity,
  EncryptionPill,
  SecureLabel,
  VerifiedMark,
  resolveCreatorMetric,
} from './CallApprovedChrome';

type OutgoingCallStageProps = {
  callKind: ChatCallKind;
  selectedUser: User | ChatGroup;
  isGroup?: boolean;
  isMicMuted: boolean;
  isCameraEnabled?: boolean;
  isSpeakerOn: boolean;
  localVideoStream?: MediaStream | null;
  currentUserAvatarUrl?: string;
  mirrorLocalPreview?: boolean;
  connectPhase: 'idle' | 'connecting' | 'slow' | 'connected' | 'failed';
  error?: string | null;
  onToggleMic: () => void;
  onToggleCamera?: () => void;
  onFlipCamera?: () => void;
  onToggleSpeaker: () => void;
  onCancel: () => void;
  onBeauty?: () => void;
  onAddFriend?: () => void;
  addFriendLabel?: string;
  addFriendDisabled?: boolean;
  showAddFriendCard?: boolean;
  onRetry?: () => void;
};

function OutgoingCallControls({
  videoCall,
  isSpeakerOn,
  isMicMuted,
  isCameraEnabled,
  onToggleSpeaker,
  onToggleMic,
  onToggleCamera,
  onBeauty,
  onCancel,
}: {
  videoCall: boolean;
  isSpeakerOn: boolean;
  isMicMuted: boolean;
  isCameraEnabled: boolean;
  onToggleSpeaker: () => void;
  onToggleMic: () => void;
  onToggleCamera?: () => void;
  onBeauty?: () => void;
  onCancel: () => void;
}) {
  if (videoCall) {
    return (
      <div className="call-approved-outgoing-actions call-approved-outgoing-actions--video">
        <button type="button" onClick={onToggleSpeaker} aria-pressed={isSpeakerOn}>
          <span className={isSpeakerOn ? 'text-violet-300' : ''}>
            <Volume2 className="h-6 w-6" />
          </span>
          Speaker
        </button>
        <button
          type="button"
          onClick={onToggleMic}
          aria-pressed={isMicMuted}
          aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          <span className={isMicMuted ? 'text-red-300' : ''}>
            {isMicMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </span>
          Mic
        </button>
        <button type="button" onClick={onCancel} className="cancel" data-ui-id="call.outgoing.video.cancel">
          <span>
            <PhoneOff className="h-7 w-7" />
          </span>
          Cancel
        </button>
        {onToggleCamera ? (
          <button
            type="button"
            onClick={onToggleCamera}
            aria-pressed={!isCameraEnabled}
            aria-label={isCameraEnabled ? 'Turn video off' : 'Turn video on'}
            data-ui-id="call.outgoing.video.toggle"
          >
            <span className={!isCameraEnabled ? 'text-red-300' : ''}>
              {isCameraEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </span>
            Video
          </button>
        ) : null}
        {onBeauty ? (
          <button
            type="button"
            onClick={onBeauty}
            aria-label="Beauty filters"
            data-ui-id="call.outgoing.video.beauty"
          >
            <span>
              <WandSparkles className="h-6 w-6" />
            </span>
            Beauty
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="call-approved-outgoing-actions">
      <button type="button" onClick={onToggleSpeaker} aria-pressed={isSpeakerOn}>
        <span className={isSpeakerOn ? 'text-violet-300' : ''}>
          <Volume2 className="h-6 w-6" />
        </span>
        Speaker
      </button>
      <button type="button" onClick={onCancel} className="cancel">
        <span>
          <PhoneOff className="h-7 w-7" />
        </span>
        Cancel
      </button>
      <button
        type="button"
        onClick={onToggleMic}
        aria-pressed={isMicMuted}
        aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        <span className={isMicMuted ? 'text-red-300' : ''}>
          {isMicMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </span>
        Mic
      </button>
    </div>
  );
}

export function OutgoingCallStage({
  callKind,
  selectedUser,
  isGroup = false,
  isMicMuted,
  isCameraEnabled = true,
  isSpeakerOn,
  localVideoStream = null,
  currentUserAvatarUrl,
  mirrorLocalPreview = true,
  connectPhase,
  error,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onToggleSpeaker,
  onCancel,
  onBeauty,
  onAddFriend,
  addFriendLabel = 'Add Friend',
  addFriendDisabled = false,
  showAddFriendCard = false,
  onRetry,
}: OutgoingCallStageProps) {
  const label = callKind === 'video' ? 'Outgoing Video Call' : 'Outgoing Audio Call';
  const name = selectedUser.displayName || (isGroup ? 'Group call' : 'Contact');
  const metric = resolveCreatorMetric(selectedUser);
  const connecting = connectPhase === 'connecting' || connectPhase === 'slow';
  const videoCall = callKind === 'video';
  const showLocalCamera = videoCall && isCameraEnabled && Boolean(localVideoStream);
  const isRinging = !error && connectPhase !== 'failed' && connectPhase !== 'connected';
  const statusLine =
    error ||
    (connecting ? 'Connecting…' : connectPhase === 'failed' ? 'Could not connect' : 'Calling…');

  if (videoCall) {
    return (
      <div className="call-approved-screen call-approved-screen--outgoing-video" data-ui-id="call.outgoing.video.v1">
        <div className="call-approved-video-root" data-ui-id="call.outgoing.video.preview">
          {showLocalCamera ? (
            <CallVideoSurface
              stream={localVideoStream}
              layout="fullscreen"
              framing="cover"
              mirrored={mirrorLocalPreview}
              label="Your camera"
            />
          ) : (
            <img
              src={currentUserAvatarUrl || selectedUser.avatarUrl || undefined}
              alt="You"
              className="absolute inset-0 h-full w-full object-cover"
              onError={handleAvatarError}
            />
          )}

          <div className="call-approved-video-header">
            <div className="call-approved-video-brand">
              <div>
                <strong>UniLive’s</strong>
                <span className="sub">
                  <SecureLabel compact /> · {label}
                </span>
              </div>
            </div>
            {onFlipCamera && isCameraEnabled ? (
              <button
                type="button"
                className="call-approved-outgoing-video-flip"
                onClick={onFlipCamera}
                aria-label="Flip camera"
              >
                <FlipHorizontal2 className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          <div className="call-approved-video-identity">
            <strong>
              {name}
              {!isGroup ? <VerifiedMark /> : null}
            </strong>
            <span>
              {connecting ? `Connecting to ${name}…` : `Calling ${name}…`}
              {metric ? ` · 🌸 ${metric}` : ''}
            </span>
            {isRinging ? <CallRingingWave /> : null}
          </div>

          {(connectPhase !== 'idle' && connectPhase !== 'connected') || error ? (
            <div className="call-approved-outgoing-video-status-pill">{statusLine}</div>
          ) : null}

          {connectPhase === 'failed' && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="call-approved-outgoing-video-retry"
            >
              Retry connection
            </button>
          ) : null}

          <div className="call-approved-video-bottom">
            <EncryptionPill />
            <OutgoingCallControls
              videoCall
              isSpeakerOn={isSpeakerOn}
              isMicMuted={isMicMuted}
              isCameraEnabled={isCameraEnabled}
              onToggleSpeaker={onToggleSpeaker}
              onToggleMic={onToggleMic}
              onToggleCamera={onToggleCamera}
              onBeauty={onBeauty}
              onCancel={onCancel}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="call-approved-screen" data-ui-id="call.outgoing.v1">
      <div className="call-approved-mobile-shell call-approved-outgoing-body call-approved-outgoing-body--audio">
        <div className="call-approved-outgoing-main">
          <CallBrand callLabel={label} />

          <CallRingingAvatar avatarUrl={selectedUser.avatarUrl} alt={name} ringing={isRinging} />
          <CreatorIdentity name={name} verified={!isGroup} metric={metric} large />
          {isRinging ? <CallRingingWave /> : null}

          <CallInfoCard>
            <div className="call-approved-call-message">
              <strong>{connecting ? `Connecting to ${name}…` : `Calling ${name}…`}</strong>
              <div className="mt-1 text-sm text-white/60">
                {error ||
                  (connectPhase === 'slow'
                    ? 'Connection is taking longer than usual.'
                    : 'Please wait while we connect you.')}
              </div>
            </div>
          </CallInfoCard>

          {connectPhase === 'failed' && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Retry connection
            </button>
          ) : null}

          <CallInfoCard icon={<span aria-hidden>✦</span>}>
            <div>
              <strong>End-to-end Encrypted</strong>
              <div className="mt-1 text-sm text-white/55">
                Your call media is private and secured by the call transport.
              </div>
            </div>
          </CallInfoCard>

          {!isGroup && showAddFriendCard && onAddFriend ? (
            <div className="call-approved-outgoing-extra w-full">
              <CallInfoCard icon={<span aria-hidden>👥</span>}>
                <div className="flex w-full items-center justify-between gap-3">
                  <div>
                    <strong>Add as friend to call anytime</strong>
                    <div className="mt-1 text-sm text-white/55">
                      Build your connection and keep this person easy to reach.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onAddFriend}
                    disabled={addFriendDisabled}
                    data-ui-id="call.outgoing.add-friend"
                    className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${
                      addFriendDisabled
                        ? 'cursor-default bg-white/10 text-white/55'
                        : 'bg-violet-600 text-white'
                    }`}
                  >
                    {addFriendLabel}
                  </button>
                </div>
              </CallInfoCard>
            </div>
          ) : null}
        </div>

        <div className="call-approved-outgoing-bottom">
          <EncryptionPill />
          <OutgoingCallControls
            videoCall={false}
            isSpeakerOn={isSpeakerOn}
            isMicMuted={isMicMuted}
            isCameraEnabled={isCameraEnabled}
            onToggleSpeaker={onToggleSpeaker}
            onToggleMic={onToggleMic}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
}

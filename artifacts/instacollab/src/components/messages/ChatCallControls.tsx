import type { ReactNode } from 'react';
import {
  Gift,
  MessageCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  PhoneOff,
  Sparkles,
  UserPlus,
  Video,
  VideoOff,
  Volume2,
  WandSparkles,
} from 'lucide-react';
import type { ChatCallKind } from '../../lib/chat/chatCallKit';
import { CallCircleAction } from './CallApprovedChrome';

type ChatCallControlsProps = {
  callKind: ChatCallKind;
  isMicMuted: boolean;
  isCameraEnabled: boolean;
  isSpeakerOn?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera?: () => void;
  onToggleSpeaker?: () => void;
  onEndCall: () => void;
  onGift?: () => void;
  onEffects?: () => void;
  onSticker?: () => void;
  onBeauty?: () => void;
  onChat?: () => void;
  onInvite?: () => void;
  onMore?: () => void;
  compact?: boolean;
  showCameraOnAudio?: boolean;
  isGroupCall?: boolean;
  endLabel?: string;
  /** Kept for backward compatibility with the existing PiP/camera effects path. */
  extraBeforeEnd?: ReactNode;
};

export function ChatCallControls({
  callKind,
  isMicMuted,
  isCameraEnabled,
  isSpeakerOn = false,
  onToggleMic,
  onToggleCamera,
  onToggleSpeaker,
  onEndCall,
  onGift,
  onEffects,
  onSticker,
  onBeauty,
  onChat,
  onInvite,
  onMore,
  compact = false,
  isGroupCall = false,
  endLabel,
  extraBeforeEnd,
}: ChatCallControlsProps) {
  const videoCall = callKind === 'video';

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={onToggleMic} className={`flex h-9 w-9 items-center justify-center rounded-full ${isMicMuted ? 'bg-red-500 text-white' : 'bg-white/15 text-white'}`} aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}>
          {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        {videoCall ? (
          <button type="button" onClick={onToggleCamera} className={`flex h-9 w-9 items-center justify-center rounded-full ${isCameraEnabled ? 'bg-white/15 text-white' : 'bg-red-500 text-white'}`} aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}>
            {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>
        ) : null}
        {extraBeforeEnd}
        <button type="button" onClick={onEndCall} className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white" aria-label="End call">
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!videoCall) {
    return (
      <div className="call-approved-controls-panel" data-ui-id="call.controls.audio">
        <div className="call-approved-controls-row">
          <CallCircleAction
            icon={isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            label="Mic"
            active={!isMicMuted}
            onClick={onToggleMic}
            dataUiId="call.action.mic"
          />
          <CallCircleAction
            icon={<Volume2 className="h-5 w-5" />}
            label="Speaker"
            active={isSpeakerOn}
            onClick={onToggleSpeaker || (() => undefined)}
            dataUiId="call.action.speaker"
          />
          <CallCircleAction
            icon={<PhoneOff className="h-6 w-6" />}
            label={endLabel || (isGroupCall ? 'Leave' : 'End Call')}
            danger
            onClick={onEndCall}
            dataUiId="call.action.end"
          />
          <CallCircleAction
            icon={<UserPlus className="h-5 w-5" />}
            label="Invite"
            onClick={onInvite || (() => undefined)}
            dataUiId="call.action.invite"
          />
          <CallCircleAction
            icon={<MoreHorizontal className="h-5 w-5" />}
            label="More"
            onClick={onMore || (() => undefined)}
            dataUiId="call.action.more"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="call-approved-controls-panel" data-ui-id="call.controls.video">
      <div className="call-approved-controls-row">
        <CallCircleAction
          icon={isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          label="Video"
          active={isCameraEnabled}
          onClick={onToggleCamera}
          dataUiId="call.action.video"
        />
        <CallCircleAction
          icon={isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          label="Mic"
          active={!isMicMuted}
          onClick={onToggleMic}
          dataUiId="call.action.mic"
        />
        <CallCircleAction
          icon={<PhoneOff className="h-6 w-6" />}
          label={endLabel || 'End Call'}
          danger
          onClick={onEndCall}
          dataUiId="call.action.end"
        />
        <CallCircleAction
          icon={<Volume2 className="h-5 w-5" />}
          label="Speaker"
          active={isSpeakerOn}
          onClick={onToggleSpeaker || (() => undefined)}
          dataUiId="call.action.speaker"
        />
        <CallCircleAction
          icon={<Gift className="h-5 w-5" />}
          label="Gift"
          active
          onClick={onGift || (() => undefined)}
          dataUiId="call.action.gift"
        />
      </div>
      <div className="call-approved-controls-row">
        <CallCircleAction icon={<Sparkles className="h-5 w-5" />} label="Effects" onClick={onEffects || (() => undefined)} dataUiId="call.action.effects" />
        <CallCircleAction icon={<span className="text-xl">☺</span>} label="Sticker" onClick={onSticker || (() => undefined)} dataUiId="call.action.sticker" />
        <CallCircleAction icon={<WandSparkles className="h-5 w-5" />} label="Beauty" onClick={onBeauty || (() => undefined)} dataUiId="call.action.beauty" />
        <CallCircleAction icon={<MessageCircle className="h-5 w-5" />} label="Chat" onClick={onChat || (() => undefined)} dataUiId="call.action.chat" />
        <CallCircleAction icon={<MoreHorizontal className="h-5 w-5" />} label="More" onClick={onMore || (() => undefined)} dataUiId="call.action.more" />
      </div>
    </div>
  );
}

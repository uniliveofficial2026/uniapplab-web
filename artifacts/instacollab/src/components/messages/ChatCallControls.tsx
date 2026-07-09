import type { ReactNode } from 'react';
import { Mic, MicOff, PhoneOff, SwitchCamera, Video, VideoOff } from 'lucide-react';
import type { ChatCallKind } from '../../lib/chat/chatCallKit';

type ChatCallControlsProps = {
  callKind: ChatCallKind;
  isMicMuted: boolean;
  isCameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera?: () => void;
  onEndCall: () => void;
  compact?: boolean;
  /** Show camera toggle on audio calls (optional video). Default true. */
  showCameraOnAudio?: boolean;
  /** Extra circular controls (e.g. AR / Beauty) before the end-call button. */
  extraBeforeEnd?: ReactNode;
};

export function ChatCallControls({
  callKind,
  isMicMuted,
  isCameraEnabled,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onEndCall,
  compact = false,
  showCameraOnAudio = true,
  extraBeforeEnd,
}: ChatCallControlsProps) {
  const videoCall = callKind === 'video';
  const showCamera = videoCall || showCameraOnAudio;
  const btn = compact ? 'h-9 w-9' : 'h-14 w-14';
  const icon = compact ? 'h-4 w-4' : 'h-6 w-6';
  const endBtn = compact ? 'h-10 w-10' : 'h-16 w-16';
  const endIcon = compact ? 'h-4 w-4' : 'h-7 w-7';

  return (
    <div className={`flex items-center justify-center ${compact ? 'gap-2' : 'gap-4 sm:gap-6'}`}>
      <button
        type="button"
        onClick={onToggleMic}
        className={`flex ${btn} items-center justify-center rounded-full transition-colors ${
          isMicMuted ? 'bg-red-500/90 text-white' : 'bg-white/15 text-white hover:bg-white/25'
        }`}
        aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        {isMicMuted ? <MicOff className={icon} /> : <Mic className={icon} />}
      </button>

      {showCamera ? (
        <>
          <button
            type="button"
            onClick={onToggleCamera}
            className={`flex ${btn} items-center justify-center rounded-full transition-colors ${
              !isCameraEnabled ? 'bg-red-500/90 text-white' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            aria-label={
              isCameraEnabled
                ? 'Turn camera off'
                : videoCall
                  ? 'Turn camera on'
                  : 'Turn camera on (optional)'
            }
          >
            {isCameraEnabled ? <Video className={icon} /> : <VideoOff className={icon} />}
          </button>
          {onFlipCamera && isCameraEnabled ? (
            <button
              type="button"
              onClick={onFlipCamera}
              className={`flex ${btn} items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors`}
              aria-label="Flip camera"
            >
              <SwitchCamera className={icon} />
            </button>
          ) : null}
        </>
      ) : null}

      {extraBeforeEnd}

      <button
        type="button"
        onClick={onEndCall}
        className={`flex ${endBtn} items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors`}
        aria-label="End call"
      >
        <PhoneOff className={endIcon} />
      </button>
    </div>
  );
}

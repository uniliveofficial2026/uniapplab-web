import React from 'react';
import {
  CAMERA_AR_BUTTON_LABEL,
  CAMERA_BEAUTY_BUTTON_LABEL,
} from '../../lib/camera/cameraBeautyLabels';
import {
  Gamepad2,
  Gift,
  Mic,
  MicOff,
  ScanFace,
  Sofa,
  Sparkles,
  SwitchCamera,
  UserMinus,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import type { CameraFacingMode } from '../../lib/camera/useCameraStream';

export type RoomFooterTrayActionsProps = {
  userSeatKey: string | null;
  userMicOn: boolean;
  userVoiceActive: boolean;
  userMicAdminMuted?: boolean;
  onToggleUserMic: () => void;
  onToggleSeatParticipation: () => void;
  /** Join/leave seat control — guests only; hide for host. */
  showSeatToggle?: boolean;
  onOpenGuestManagement: () => void;
  guestManagementOpen?: boolean;
  onOpenGiftPicker: () => void;
  showCamera?: boolean;
  userCameraOn?: boolean;
  onToggleUserCamera?: () => void;
  cameraFacingMode?: CameraFacingMode;
  onToggleCameraFacing?: () => void;
  showDeepAR?: boolean;
  effectsPanelOpen?: boolean;
  deeparEffectActive?: boolean;
  onToggleEffectsPanel?: () => void;
  /** Tencent RTC–style beauty tray (Solo Live / Multi-Guest). */
  showBeauty?: boolean;
  beautyPanelOpen?: boolean;
  beautyActive?: boolean;
  onToggleBeautyPanel?: () => void;
  /** PK battles placeholder — full flow coming soon. */
  onPkClick?: () => void;
  /** In-room games placeholder — full flow coming soon. */
  onGameClick?: () => void;
  /** Party / Watch Together use cyan mic accent; Multi-Guest uses purple. */
  micAccent?: 'cyan' | 'purple';
  className?: string;
};

const btnBase =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition active:scale-90 sm:h-9 sm:w-9';

/**
 * Shared live-room footer tray — mic, camera, join/leave seat, guest mgmt, gifts.
 * Seat join/leave is always routed through onToggleSeatParticipation (Room.tsx).
 */
export function RoomFooterTrayActions({
  userSeatKey,
  userMicOn,
  userVoiceActive,
  userMicAdminMuted = false,
  onToggleUserMic,
  onToggleSeatParticipation,
  showSeatToggle = true,
  onOpenGuestManagement,
  guestManagementOpen = false,
  onOpenGiftPicker,
  showCamera = false,
  userCameraOn = false,
  onToggleUserCamera,
  cameraFacingMode = 'user',
  onToggleCameraFacing,
  showDeepAR = false,
  effectsPanelOpen = false,
  deeparEffectActive = false,
  onToggleEffectsPanel,
  showBeauty = false,
  beautyPanelOpen = false,
  beautyActive = false,
  onToggleBeautyPanel,
  onPkClick,
  onGameClick,
  micAccent = 'cyan',
  className = '',
}: RoomFooterTrayActionsProps) {
  const micTitle = userSeatKey
    ? userMicOn
      ? 'Mute your microphone'
      : userMicAdminMuted
        ? 'Your mic is locked by the host'
        : 'Unmute your microphone'
    : 'Join a seat to use your microphone';

  const micClass =
    userSeatKey && userMicOn
      ? userVoiceActive
        ? micAccent === 'purple'
          ? 'animate-pulse border-purple-400/60 bg-purple-500/25 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.45)]'
          : 'border-cyan-400/60 bg-cyan-500/25 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.45)] animate-pulse'
        : micAccent === 'purple'
          ? 'border-purple-400/40 bg-purple-500/20 text-purple-200'
          : 'border-cyan-400/40 bg-cyan-500/20 text-cyan-200'
      : userSeatKey
        ? 'border-red-500/40 bg-red-500/15 text-red-300'
        : 'border-white/10 bg-white/10 text-white/70';

  return (
    <div
      className={`flex w-full min-w-0 shrink-0 items-center justify-between gap-1 overflow-x-auto scrollbar-hide sm:w-auto sm:justify-end sm:gap-1.5 ${className}`}
    >
      <button
        type="button"
        onClick={onPkClick}
        title="PK battle (coming soon)"
        aria-label="PK battle (coming soon)"
        className={`${btnBase} border-blue-400/30 bg-gradient-to-b from-blue-700 to-blue-900 text-[9px] font-black text-white shadow-lg hover:from-blue-600 hover:to-blue-800`}
      >
        PK
      </button>

      <button
        type="button"
        onClick={onGameClick}
        title="Games (coming soon)"
        aria-label="Games (coming soon)"
        className={`${btnBase} border-violet-400/35 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30`}
      >
        <Gamepad2 size={16} />
      </button>

      <button
        type="button"
        onClick={onToggleUserMic}
        title={micTitle}
        aria-label={micTitle}
        className={`${btnBase} ${micClass}`}
      >
        {userSeatKey && !userMicOn ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      {showCamera && onToggleUserCamera ? (
        <button
          type="button"
          onClick={() => {
            if (!userSeatKey) {
              onToggleSeatParticipation();
              return;
            }
            onToggleUserCamera();
          }}
          className={`${btnBase} ${
            userSeatKey && userCameraOn
              ? 'border-emerald-400/55 bg-emerald-500/20 text-emerald-200'
              : userSeatKey
                ? 'border-red-500/40 bg-red-500/15 text-red-300'
                : 'border-white/10 bg-white/10 text-white/70'
          }`}
          aria-label={
            userSeatKey
              ? userCameraOn
                ? 'Turn camera off'
                : 'Turn camera on'
              : 'Join a seat to use your camera'
          }
          title={
            userSeatKey
              ? userCameraOn
                ? 'Turn camera off'
                : 'Turn camera on'
              : 'Join a seat to use your camera'
          }
        >
          {userCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
        </button>
      ) : null}

      {showCamera && onToggleCameraFacing ? (
        <button
          type="button"
          onClick={() => {
            if (!userSeatKey || !userCameraOn) return;
            onToggleCameraFacing();
          }}
          disabled={!userSeatKey || !userCameraOn}
          className={`${btnBase} disabled:cursor-not-allowed disabled:opacity-40 border-white/10 bg-white/10 text-white/80 hover:bg-white/15`}
          aria-label={
            cameraFacingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'
          }
          title={cameraFacingMode === 'user' ? 'Back camera' : 'Front camera'}
        >
          <SwitchCamera size={16} />
        </button>
      ) : null}

      {showSeatToggle ? (
        <button
          type="button"
          onClick={onToggleSeatParticipation}
          className={`${btnBase} ${
            userSeatKey
              ? 'border-pink-400/45 bg-pink-500/20 text-pink-200'
              : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
          }`}
          title={userSeatKey ? 'Leave seat' : 'Join a seat'}
          aria-label={userSeatKey ? 'Leave seat' : 'Join a seat'}
        >
          {userSeatKey ? <UserMinus size={16} /> : <Sofa size={16} />}
        </button>
      ) : null}

      {showBeauty && onToggleBeautyPanel ? (
        <button
          type="button"
          onClick={() => {
            if (!userSeatKey || !userCameraOn) return;
            onToggleBeautyPanel();
          }}
          disabled={!userSeatKey || !userCameraOn}
          className={`${btnBase} disabled:cursor-not-allowed disabled:opacity-40 ${
            beautyPanelOpen
              ? 'border-rose-300/70 bg-rose-500/30 text-rose-100'
              : beautyActive
                ? 'border-rose-400/55 bg-rose-500/20 text-rose-200'
                : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/15'
          }`}
          title={
            !userSeatKey
              ? `Take a seat to use ${CAMERA_BEAUTY_BUTTON_LABEL}`
              : !userCameraOn
                ? `Turn on camera for ${CAMERA_BEAUTY_BUTTON_LABEL}`
                : beautyPanelOpen
                  ? `Close ${CAMERA_BEAUTY_BUTTON_LABEL}`
                  : beautyActive
                    ? `${CAMERA_BEAUTY_BUTTON_LABEL} on — tap to edit`
                    : `${CAMERA_BEAUTY_BUTTON_LABEL} (skin, makeup, filters)`
          }
          aria-label={CAMERA_BEAUTY_BUTTON_LABEL}
          aria-pressed={beautyPanelOpen || beautyActive}
        >
          <ScanFace size={16} />
        </button>
      ) : null}

      {showDeepAR && onToggleEffectsPanel ? (
        <button
          type="button"
          onClick={() => {
            if (!userSeatKey || !userCameraOn) return;
            onToggleEffectsPanel();
          }}
          disabled={!userSeatKey || !userCameraOn}
          className={`${btnBase} disabled:cursor-not-allowed disabled:opacity-40 ${
            effectsPanelOpen
              ? 'border-fuchsia-300/70 bg-fuchsia-500/30 text-fuchsia-100'
              : deeparEffectActive
                ? 'border-fuchsia-400/55 bg-fuchsia-500/20 text-fuchsia-200'
                : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/15'
          }`}
          title={
            !userSeatKey
              ? `Take a seat to use ${CAMERA_AR_BUTTON_LABEL}`
              : !userCameraOn
                ? `Turn on camera for ${CAMERA_AR_BUTTON_LABEL}`
                : effectsPanelOpen
                  ? `Close ${CAMERA_AR_BUTTON_LABEL}`
                  : deeparEffectActive
                    ? `${CAMERA_AR_BUTTON_LABEL} on — tap to edit`
                    : `${CAMERA_AR_BUTTON_LABEL} (masks, looks, AR)`
          }
          aria-label={`${CAMERA_AR_BUTTON_LABEL} effects`}
          aria-pressed={effectsPanelOpen || deeparEffectActive}
        >
          <Sparkles size={16} />
        </button>
      ) : null}

      <button
        type="button"
        onClick={onOpenGuestManagement}
        title="Guest management"
        aria-label="Guest management"
        className={`${btnBase} ${
          guestManagementOpen
            ? 'border-purple-500/40 bg-purple-500/20 text-purple-300'
            : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/15'
        }`}
      >
        <Users size={16} />
      </button>

      <button
        type="button"
        onClick={onOpenGiftPicker}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-tr from-pink-500 to-yellow-400 p-px transition active:scale-90 sm:h-9 sm:w-9"
        aria-label="Send gift"
        title="Send gift"
      >
        <div className="flex h-full w-full items-center justify-center rounded-[9px] bg-[#0d011c]">
          <Gift size={16} className="text-yellow-400" />
        </div>
      </button>
    </div>
  );
}

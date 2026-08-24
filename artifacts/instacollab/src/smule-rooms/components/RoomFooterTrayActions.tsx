import React from 'react';
import {
  Gamepad2,
  Gift,
  Heart,
  Mic,
  MicOff,
  ScanFace,
  ShoppingBag,
  Smile,
  Sofa,
  Sparkles,
  UserMinus,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { useOptionalLiveLike } from '../liveLike/LiveLikeContext';

export type RoomFooterTrayActionsProps = {
  userSeatKey: string | null;
  userMicOn: boolean;
  userVoiceActive: boolean;
  userMicAdminMuted?: boolean;
  onToggleUserMic: () => void;
  onToggleSeatParticipation: () => void;
  onOpenGuestManagement: () => void;
  guestManagementOpen?: boolean;
  onOpenGiftPicker: () => void;
  onOpenStickers?: () => void;
  stickersOpen?: boolean;
  showCamera?: boolean;
  userCameraOn?: boolean;
  onToggleUserCamera?: () => void;
  showDeepAR?: boolean;
  effectsPanelOpen?: boolean;
  deeparEffectActive?: boolean;
  onToggleEffectsPanel?: () => void;
  showBeauty?: boolean;
  beautyPanelOpen?: boolean;
  beautyActive?: boolean;
  onToggleBeautyPanel?: () => void;
  showShop?: boolean;
  shopPanelOpen?: boolean;
  shopActive?: boolean;
  onToggleShopPanel?: () => void;
  showPkBadge?: boolean;
  /** PK battles — opens PK flow or coming-soon toast. */
  onPkClick?: () => void;
  /** In-room games — opens game live / coming-soon toast. */
  onGameClick?: () => void;
  /** Web Audio voice changer (LiveKit publish). */
  showVoiceChanger?: boolean;
  /** Seated (or game-live host) — can open FX even when mic is muted. */
  voiceChangerEligible?: boolean;
  voiceChangerOpen?: boolean;
  voiceEffectActive?: boolean;
  voiceEffectEmoji?: string;
  onToggleVoiceChanger?: () => void;
  /** Join/leave seat control. */
  showSeatToggle?: boolean;
  /** Guest management button. */
  showGuestManagement?: boolean;
  /** Gift picker button. */
  showGift?: boolean;
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
  onOpenGuestManagement,
  guestManagementOpen = false,
  onOpenGiftPicker,
  onOpenStickers,
  stickersOpen = false,
  showCamera = false,
  userCameraOn = false,
  onToggleUserCamera,
  showDeepAR = false,
  effectsPanelOpen = false,
  deeparEffectActive = false,
  onToggleEffectsPanel,
  showBeauty = false,
  beautyPanelOpen = false,
  beautyActive = false,
  onToggleBeautyPanel,
  showShop = false,
  shopPanelOpen = false,
  shopActive = false,
  onToggleShopPanel,
  showPkBadge = false,
  onPkClick,
  onGameClick,
  showVoiceChanger = false,
  voiceChangerEligible = false,
  voiceChangerOpen = false,
  voiceEffectActive = false,
  voiceEffectEmoji,
  onToggleVoiceChanger,
  showSeatToggle = true,
  showGuestManagement = true,
  showGift = true,
  micAccent = 'cyan',
  className = '',
}: RoomFooterTrayActionsProps) {
  const liveLike = useOptionalLiveLike();
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
      className={`room-footer-tray flex w-full min-w-0 shrink-0 flex-nowrap items-center justify-between gap-1.5 sm:w-auto sm:justify-end sm:gap-1.5 sm:overflow-x-visible ${className}`}
    >
      {onPkClick ? (
        <button
          type="button"
          onClick={onPkClick}
          title="PK battle"
          aria-label="PK battle"
          className={`${btnBase} border-blue-400/30 bg-gradient-to-b from-blue-700 to-blue-900 text-[9px] font-black text-white shadow-lg hover:from-blue-600 hover:to-blue-800`}
        >
          PK
        </button>
      ) : showPkBadge ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-gradient-to-b from-blue-700 to-blue-900 text-[9px] font-black text-white shadow-lg sm:h-9 sm:w-9">
          PK
        </div>
      ) : null}

      {onGameClick ? (
        <button
          type="button"
          onClick={onGameClick}
          title="Games"
          aria-label="Games"
          className={`${btnBase} border-violet-400/35 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30`}
        >
          <Gamepad2 size={16} />
        </button>
      ) : null}

      <button
        type="button"
        onClick={onToggleUserMic}
        title={micTitle}
        aria-label={micTitle}
        className={`${btnBase} ${micClass}`}
      >
        {userSeatKey && !userMicOn ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      {showVoiceChanger && onToggleVoiceChanger ? (
        <button
          type="button"
          onClick={() => {
            if (!voiceChangerEligible) return;
            onToggleVoiceChanger();
          }}
          disabled={!voiceChangerEligible}
          className={`${btnBase} disabled:cursor-not-allowed disabled:opacity-40 ${
            voiceChangerOpen || voiceEffectActive
              ? 'border-pink-400/55 bg-pink-500/20 text-pink-100'
              : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/15'
          }`}
          title={voiceChangerEligible ? 'Voice changer' : 'Join a seat to use voice changer'}
          aria-label={voiceChangerEligible ? 'Voice changer' : 'Join a seat to use voice changer'}
        >
          <span className="text-[11px] font-black leading-none">
            {voiceEffectActive && voiceEffectEmoji ? voiceEffectEmoji : 'FX'}
          </span>
        </button>
      ) : null}

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
              ? 'Take a seat to use DeepAR filters'
              : !userCameraOn
                ? 'Turn on camera for DeepAR filters'
                : 'DeepAR filters'
          }
          aria-label={
            !userSeatKey
              ? 'Take a seat to use DeepAR filters'
              : !userCameraOn
                ? 'Turn on camera for DeepAR filters'
                : 'DeepAR filters'
          }
        >
          <Sparkles size={16} />
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
              ? 'border-rose-300/70 bg-rose-500/30 text-rose-50'
              : beautyActive
                ? 'border-rose-400/55 bg-rose-500/20 text-rose-200'
                : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/15'
          }`}
          title={
            !userSeatKey
              ? 'Take a seat to use beauty'
              : !userCameraOn
                ? 'Turn on camera for beauty'
                : 'Beauty'
          }
          aria-label={
            !userSeatKey
              ? 'Take a seat to use beauty'
              : !userCameraOn
                ? 'Turn on camera for beauty'
                : 'Beauty'
          }
        >
          <ScanFace size={16} />
        </button>
      ) : null}

      {showShop && onToggleShopPanel ? (
        <button
          type="button"
          onClick={onToggleShopPanel}
          className={`${btnBase} ${
            shopPanelOpen
              ? 'border-amber-300/70 bg-amber-500/30 text-amber-50'
              : shopActive
                ? 'border-amber-400/55 bg-amber-500/20 text-amber-200'
                : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/15'
          }`}
          title="Live shop"
          aria-label="Live shop"
        >
          <ShoppingBag size={16} />
        </button>
      ) : null}

      {showGuestManagement ? (
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
      ) : null}

      {liveLike ? (
        <button
          type="button"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            const stage =
              (event.currentTarget.closest('.room-shell') as HTMLElement | null) ??
              (document.querySelector('.room-shell') as HTMLElement | null);
            const rect = stage?.getBoundingClientRect();
            if (!rect) {
              liveLike.tapLike({
                xPct: (event.clientX / Math.max(1, window.innerWidth)) * 100,
                yPct: (event.clientY / Math.max(1, window.innerHeight)) * 100,
              });
              return;
            }
            liveLike.tapLike({
              xPct: ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100,
              yPct: ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100,
            });
          }}
          className={`${btnBase} relative border-rose-400/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30`}
          aria-label="Like"
          title="Like"
          data-node-id="node.live.shared.reaction-trigger"
        >
          <Heart size={16} className="fill-current" />
          {liveLike.likeCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-[14px] rounded-full bg-rose-500 px-1 text-[8px] font-black leading-4 text-white">
              {liveLike.likeCount > 999 ? '999+' : liveLike.likeCount}
            </span>
          ) : null}
        </button>
      ) : null}

      {onOpenStickers ? (
        <button
          type="button"
          onClick={onOpenStickers}
          className={`${btnBase} ${
            stickersOpen
              ? 'border-pink-400/55 bg-pink-500/20 text-pink-100'
              : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/15'
          }`}
          aria-label="Stickers"
          title="Stickers"
        >
          <Smile size={16} />
        </button>
      ) : null}

      {showGift ? (
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
      ) : null}
    </div>
  );
}

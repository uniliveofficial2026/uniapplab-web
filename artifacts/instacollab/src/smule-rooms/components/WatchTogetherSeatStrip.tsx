import React, { useState } from 'react';
import { Lock, Mic, MicOff, Sofa } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import { safeAvatarUrl } from '../../lib/safe';
import { useSeatTileTap } from '../hooks/useSeatTileTap';
import { buildLiveSeatFullscreenTarget } from '../utils/liveSeatFullscreenTarget';
import {
  resolveSeatGuestDisplay,
  type PartySeatMap,
  type RoomGuest,
  type RoomSeatKey,
} from '../utils/roomSeats';
import { LiveSeatFullscreenOverlay, type LiveSeatFullscreenTarget } from './LiveSeatFullscreenOverlay';
import {
  SeatHeartbeatRowOverlay,
  type SeatHeartbeatLink,
} from './SeatHeartbeatRowOverlay';
import { SeatSpeakingLevelBars, SeatVoiceGlowEffect } from './SeatVoiceVisuals';

export const WATCH_TOGETHER_ROW1: RoomSeatKey[] = ['no1', 'no2', 'host', 'no3', 'no4'];
export const WATCH_TOGETHER_ROW2: RoomSeatKey[] = ['no5', 'no6', 'no7', 'no8', 'no9'];

/** Game Live guest sofas only — host is the cast/PiP, not a seat. */
export const GAME_LIVE_GUEST_ROW1: RoomSeatKey[] = ['no1', 'no2', 'no3', 'no4', 'no5'];
export const GAME_LIVE_GUEST_ROW2: RoomSeatKey[] = ['no6', 'no7', 'no8', 'no9', 'no10'];

export const WATCH_TOGETHER_HEARTBEAT_ROW1: SeatHeartbeatLink[] = [
  { left: 'no1', right: 'no2', relKey: 'no1-no2', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no2', right: 'host', relKey: 'no2-host', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
  { left: 'host', right: 'no3', relKey: 'host-no3', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no3', right: 'no4', relKey: 'no3-no4', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
];

export const WATCH_TOGETHER_HEARTBEAT_ROW2: SeatHeartbeatLink[] = [
  { left: 'no5', right: 'no6', relKey: 'no5-no6', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no6', right: 'no7', relKey: 'no6-no7', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
  { left: 'no7', right: 'no8', relKey: 'no7-no8', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no8', right: 'no9', relKey: 'no8-no9', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
];

export const GAME_LIVE_HEARTBEAT_ROW1: SeatHeartbeatLink[] = [
  { left: 'no1', right: 'no2', relKey: 'no1-no2', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no2', right: 'no3', relKey: 'no2-no3', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
  { left: 'no3', right: 'no4', relKey: 'no3-no4', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no4', right: 'no5', relKey: 'no4-no5', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
];

export const GAME_LIVE_HEARTBEAT_ROW2: SeatHeartbeatLink[] = [
  { left: 'no6', right: 'no7', relKey: 'no6-no7', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no7', right: 'no8', relKey: 'no7-no8', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
  { left: 'no8', right: 'no9', relKey: 'no8-no9', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no9', right: 'no10', relKey: 'no9-no10', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
];

type ChatViewerPayload = {
  id: string;
  name: string;
  avatar: string;
  isOwner: boolean;
  isCoOwner?: boolean;
  isAdmin: boolean;
  isFollowing: boolean;
};

function truncateName(name: string, max = 12): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function getSeatFrameClasses(frameStyle: string): string {
  switch (frameStyle) {
    case 'cyan-crown':
      return 'border-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]';
    case 'gold-wings':
      return 'border-2 border-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.5)]';
    case 'gold':
      return 'border-2 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.5)]';
    default:
      return 'border-2 border-white/25 shadow-[0_0_8px_rgba(255,255,255,0.12)]';
  }
}

function seatLabel(key: RoomSeatKey): string {
  if (key === 'host') return 'HOST';
  return `NO.${key.replace('no', '')}`;
}

export type WatchTogetherSeatStripProps = {
  roomDisplayId: string;
  viewerUserId?: string;
  activeSeats: PartySeatMap;
  lockedSeats?: Record<string, boolean>;
  handleSeatClick: (seatKey: string) => void;
  handleToggleSeatMic: (key: string) => void;
  buildViewerFromGuest: (guest: RoomGuest, seatKey: string) => ChatViewerPayload;
  handleSelectViewer: (viewer: ChatViewerPayload) => void;
  onOpenGiftSenders: (receiver: { name: string; userId?: string }) => void;
  mutuallyFollowing?: Record<string, boolean>;
  toggleHeartbeat?: (key1: string, key2: string) => void;
  userSeatKey: string | null;
  userMicOn: boolean;
  userVoiceActive: boolean;
  userMicLevel?: number;
  audioPulse?: number;
  className?: string;
  /** Watch Together keeps a host sofa; Game Live does not (host is cast/PiP). */
  layout?: 'watchTogether' | 'gameLive';
};

export function WatchTogetherSeatStrip({
  roomDisplayId,
  viewerUserId,
  activeSeats,
  lockedSeats = {},
  handleSeatClick,
  handleToggleSeatMic,
  buildViewerFromGuest,
  handleSelectViewer,
  onOpenGiftSenders,
  mutuallyFollowing = {},
  toggleHeartbeat,
  userSeatKey,
  userMicOn,
  userVoiceActive,
  userMicLevel = 0,
  audioPulse = 0,
  className = '',
  layout = 'watchTogether',
}: WatchTogetherSeatStripProps) {
  const handleSeatTileTap = useSeatTileTap();
  const [seatFullscreenTarget, setSeatFullscreenTarget] = useState<LiveSeatFullscreenTarget | null>(
    null,
  );

  const isGameLive = layout === 'gameLive';
  const row1 = isGameLive ? GAME_LIVE_GUEST_ROW1 : WATCH_TOGETHER_ROW1;
  const row2 = isGameLive ? GAME_LIVE_GUEST_ROW2 : WATCH_TOGETHER_ROW2;
  const heartbeat1 = isGameLive ? GAME_LIVE_HEARTBEAT_ROW1 : WATCH_TOGETHER_HEARTBEAT_ROW1;
  const heartbeat2 = isGameLive ? GAME_LIVE_HEARTBEAT_ROW2 : WATCH_TOGETHER_HEARTBEAT_ROW2;
  const row1GridClass = 'watch-together-seat-grid-5';
  const row2GridClass = 'watch-together-seat-grid-5';
  const heartbeatSlotPrefix = isGameLive
    ? ('game-live-heartbeat-slot' as const)
    : ('watch-together-heartbeat-slot' as const);

  const renderSeat = (key: RoomSeatKey) => {
    const isHost = key === 'host';
    const rawOccupant = activeSeats[key];
    const occupant = rawOccupant ? resolveSeatGuestDisplay(rawOccupant, roomDisplayId) : null;
    const isLocked = Boolean(lockedSeats[key]);
    const isSelfSeat = userSeatKey === key;
    const micUnmuted = Boolean(occupant?.isSpeaking);
    const voiceVisualActive = occupant
      ? micUnmuted && (isSelfSeat ? userVoiceActive : true)
      : false;
    const voicePulse = isSelfSeat && userMicOn ? userMicLevel : audioPulse;

    return (
      <div key={key} className="watch-together-seat-cell relative z-10 flex min-w-0 flex-col items-center">
        {occupant ? (
          <div className="relative flex w-full flex-col items-center">
            <div className="flex w-full flex-col items-center">
              <div className="relative overflow-visible">
                <SeatSpeakingLevelBars active={voiceVisualActive} audioPulse={voicePulse} />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!rawOccupant) {
                      handleSeatClick(key);
                      return;
                    }
                    handleSeatTileTap(
                      () => handleSeatClick(key),
                      () =>
                        setSeatFullscreenTarget(
                          buildLiveSeatFullscreenTarget(key, rawOccupant, roomDisplayId, {
                            userSeatKey,
                            selfUserId: viewerUserId,
                          }),
                        ),
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSeatClick(key);
                    }
                  }}
                  className={
                    isHost
                      ? 'party-host-avatar relative rounded-full p-[2px] cursor-pointer hover:scale-105 transition-transform bg-gradient-to-tr from-cyan-400 via-purple-600 to-pink-500 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                      : `party-guest-avatar relative rounded-full p-[2px] cursor-pointer hover:scale-105 transition-transform ${getSeatFrameClasses(occupant.frameStyle)}`
                  }
                  aria-label={isSelfSeat ? `Your ${isHost ? 'host' : 'guest'} seat` : `Send gift to ${occupant.name}`}
                >
                  <img
                    src={safeAvatarUrl(occupant.avatar)}
                    className="h-full w-full rounded-full object-cover border-2 border-[#050510]"
                    alt={occupant.name}
                  />
                </div>
                <SeatVoiceGlowEffect
                  active={voiceVisualActive}
                  audioPulse={voicePulse}
                  variant={isHost ? 'cyan' : 'pink'}
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleSeatMic(key);
                  }}
                  className={`absolute -bottom-0.5 -right-0.5 rounded-full p-1 border border-[#050510] cursor-pointer z-30 transition active:scale-95 ${
                    occupant.isSpeaking
                      ? voiceVisualActive
                        ? isHost
                          ? 'bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]'
                          : 'bg-pink-500 animate-pulse shadow-[0_0_6px_rgba(236,72,153,0.6)]'
                        : isHost
                          ? 'bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.6)]'
                          : 'bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.6)]'
                      : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                  }`}
                  aria-label={occupant.isSpeaking ? `Mute ${occupant.name}` : `Unmute ${occupant.name}`}
                >
                  {occupant.isSpeaking ? (
                    <Mic size={9} className="text-white" />
                  ) : (
                    <MicOff size={9} className="text-white" strokeWidth={3} />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => rawOccupant && handleSelectViewer(buildViewerFromGuest(rawOccupant, key))}
                className={`${
                  isHost
                    ? 'party-host-name text-cyan-300 hover:text-cyan-100'
                    : 'party-seat-name text-gray-200 hover:text-pink-300'
                } font-bold mt-1.5 truncate w-full text-center drop-shadow-sm hover:underline transition`}
              >
                {truncateName(occupant.name, isHost ? 12 : 10)}
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenGiftSenders({
                    name: occupant.name,
                    userId: rawOccupant?.userId,
                  });
                }}
                className={`party-seat-stars flex items-center space-x-0.5 px-1.5 py-[2px] rounded-full border mt-1 shadow-sm cursor-pointer transition hover:brightness-110 active:scale-95 ${
                  isHost
                    ? 'bg-cyan-950/80 border-cyan-400/40'
                    : 'bg-black/75 border-white/10'
                }`}
                aria-label={`View who sent coins to ${occupant.name}`}
              >
                <CoinIcon className="h-2 w-2 shrink-0" />
                <span className="text-[9px] font-black text-yellow-300 font-mono leading-none">
                  {occupant.stars.toLocaleString()}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center">
            <button
              type="button"
              onClick={() => handleSeatClick(key)}
              disabled={isLocked}
              className={`party-empty-seat party-glass-tap rounded-full flex items-center justify-center transform active:scale-95 cursor-pointer ${
                isLocked
                  ? 'party-glass-seat-locked text-red-400 hover:border-red-500/60'
                  : isHost
                    ? 'hover:border-cyan-300/50 text-cyan-200/80'
                    : 'party-glass-seat-guest hover:text-white'
              }`}
              aria-label={isLocked ? `${seatLabel(key)} locked` : `Take ${seatLabel(key)}`}
            >
              {isLocked ? (
                <Lock size={14} className="text-red-400" />
              ) : (
                <Sofa size={18} strokeWidth={2.2} />
              )}
            </button>
            <span className="mt-1.5 inline-flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider">
              <span
                className={
                  isLocked
                    ? 'text-red-400/90'
                    : isHost
                      ? 'text-cyan-300/90'
                      : 'text-[#a08070]'
                }
              >
                {seatLabel(key)}
              </span>
              {isLocked ? <Lock size={7} className="text-red-500" /> : null}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={`watch-together-seats relative z-20 shrink-0 px-1 ${className}`.trim()}>
        <div className={row1GridClass}>
          {toggleHeartbeat ? (
            <SeatHeartbeatRowOverlay
              segments={heartbeat1}
              mutuallyFollowing={mutuallyFollowing}
              activeSeats={activeSeats}
              onToggle={toggleHeartbeat}
              slotClassPrefix={heartbeatSlotPrefix}
            />
          ) : null}
          {row1.map((key) => renderSeat(key))}
        </div>
        <div className={row2GridClass}>
          {toggleHeartbeat ? (
            <SeatHeartbeatRowOverlay
              segments={heartbeat2}
              mutuallyFollowing={mutuallyFollowing}
              activeSeats={activeSeats}
              onToggle={toggleHeartbeat}
              slotClassPrefix={heartbeatSlotPrefix}
            />
          ) : null}
          {row2.map((key) => renderSeat(key))}
        </div>
      </div>
      <LiveSeatFullscreenOverlay
        target={seatFullscreenTarget}
        onClose={() => setSeatFullscreenTarget(null)}
      />
    </>
  );
}

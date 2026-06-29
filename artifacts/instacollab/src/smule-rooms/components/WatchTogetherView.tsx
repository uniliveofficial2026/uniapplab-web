import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  Star,
  Mic,
  MicOff,
  Send,
  Menu,
  ChevronRight,
  Video,
  LayoutGrid,
  LogOut,
  Lock,
  Gift,
  Upload,
  Sofa,
  Info,
  Settings2,
  Pencil,
} from 'lucide-react';
import { WatchTogetherMediaSourceSheet } from './WatchTogetherMediaSourceSheet';
import type { RoomExpProgress } from '../utils/roomExp';
import type { RoomGiftSummary } from '../utils/roomGifts';
import type { PartySeatMap, RoomGuest, RoomSeatKey } from '../utils/roomSeats';
import { resolveSeatGuestDisplay } from '../utils/roomSeats';
import type { RoomViewerEntry } from '../utils/roomViewers';
import type { RoomSettings } from '../utils/storage';
import type { RoomBackgroundMode } from '../utils/roomBackground';
import {
  type WatchTogetherMedia,
  type WatchTogetherMediaUpdateDetail,
  hydrateWatchTogetherMedia,
} from '../utils/watchTogetherMedia';
import { RoomArenaColumn } from './RoomArenaLeaderboard';
import type { ArenaLeaderboardParticipant } from './RoomArenaLeaderboard';
import { RoomBackgroundLayer } from './RoomBackgroundLayer';
import { RoomLiveHeaderInfo } from './RoomLiveHeaderInfo';
import { RoomHeaderActionsMenu, type RoomHeaderMenuItem } from './RoomHeaderActionsMenu';
import { ShareIcon } from '../../components/common/ShareIcon';
import {
  SeatHeartbeatRowOverlay,
  type SeatHeartbeatLink,
} from './SeatHeartbeatRowOverlay';
import { SeatSpeakingLevelBars, SeatVoiceGlowEffect } from './SeatVoiceVisuals';

type ChatAuthorMsg = {
  user?: string;
  userId?: string;
  isOwner?: boolean;
  isAdmin?: boolean;
};

type LiveChatMsg = ChatAuthorMsg & {
  id?: number | string;
  text?: string;
  isJoinEvent?: boolean;
  isGiftEvent?: boolean;
  isSystem?: boolean;
  isSingEvent?: 'start' | 'end';
  songTitle?: string;
  score?: number;
  giftIcon?: string;
  giftName?: string;
  receiver?: string;
  giftAmount?: number;
};

type ChatViewerPayload = {
  id: string;
  name: string;
  avatar: string;
  isOwner: boolean;
  isCoOwner?: boolean;
  isAdmin: boolean;
  isFollowing: boolean;
};

interface WatchTogetherViewProps {
  roomDisplayId: string;
  roomTitle: string;
  announcement: string;
  isRoomSaved: boolean;
  roomIdCopied: boolean;
  onCopyRoomId: (event: React.MouseEvent) => void;
  onToggleSaveRoom: (event: React.MouseEvent) => void;
  watchTogetherMedia: WatchTogetherMedia;
  roomSettings: Pick<RoomSettings, 'roomId' | 'owner' | 'ownerUserId' | 'roomName'>;
  viewerUserId: string;
  onLeaveRoom: () => void;
  onShareRoom: () => void;
  onOpenRoomDetails: () => void;
  onOpenRoomEdit?: () => void;
  activeSeats: PartySeatMap;
  viewers: RoomViewerEntry[];
  roomExpProgress: RoomExpProgress;
  roomGiftSummary: RoomGiftSummary;
  handleSeatClick: (key: string) => void;
  handleToggleSeatMic: (key: string) => void;
  buildViewerFromGuest: (guest: RoomGuest, seatKey: string) => ChatViewerPayload;
  handleSelectViewer: (viewer: ChatViewerPayload) => void;
  setIsRoomBackgroundMenuOpen: (open: boolean) => void;
  setIsRoomViewersOpen: (open: boolean) => void;
  setIsGiftPickerOpen: (open: boolean) => void;
  setIsGuestManagementOpen: (open: boolean) => void;
  liveChatMsgs: LiveChatMsg[];
  chatInput: string;
  handleChatInputChange: (val: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  handleChatScroll: () => void;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
  getMentionSuggestions: () => Array<{ name: string; avatar: string }>;
  selectMention: (name: string) => void;
  mutuallyFollowing: Record<string, boolean>;
  toggleHeartbeat: (key1: string, key2: string) => void;
  renderJoinChatEvent: (message: LiveChatMsg & { id: string | number }) => React.ReactNode;
  renderSingChatEvent: (message: LiveChatMsg & { id: string | number }) => React.ReactNode;
  renderGiftChatEvent: (message: LiveChatMsg & { id: string | number }) => React.ReactNode;
  renderStandardChatMessage: (
    message: LiveChatMsg & { id: string | number },
    options?: { bubbleClassName?: string; layout?: 'stacked' | 'inline' },
  ) => React.ReactNode;
  mentionSearch: string | null;
  onToggleUserMic: () => void;
  userSeatKey: string | null;
  userMicOn: boolean;
  userVoiceActive: boolean;
  userMicLevel: number;
  audioPulse: number;
  canChangeRoomBackground: boolean;
  backgroundMode: RoomBackgroundMode;
  pendingBackgroundMode: RoomBackgroundMode | null;
  arenaParticipants: ArenaLeaderboardParticipant[];
  arenaCountdownText: string;
  onOpenArenaRankings: () => void;
  lockedSeats: Record<string, boolean>;
  canManageMedia: boolean;
  showToast: (message: string) => void;
  canEditAnnouncement?: boolean;
  onEditAnnouncement?: () => void;
  canChangeRoomMode?: boolean;
  onOpenRoomModePicker?: () => void;
}

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

const WATCH_TOGETHER_ROW1: RoomSeatKey[] = ['no1', 'no2', 'host', 'no3', 'no4'];
const WATCH_TOGETHER_ROW2: RoomSeatKey[] = ['no5', 'no6', 'no7', 'no8', 'no9'];

const WATCH_TOGETHER_HEARTBEAT_ROW1: SeatHeartbeatLink[] = [
  { left: 'no1', right: 'no2', relKey: 'no1-no2', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no2', right: 'host', relKey: 'no2-host', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
  { left: 'host', right: 'no3', relKey: 'host-no3', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no3', right: 'no4', relKey: 'no3-no4', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
];

const WATCH_TOGETHER_HEARTBEAT_ROW2: SeatHeartbeatLink[] = [
  { left: 'no5', right: 'no6', relKey: 'no5-no6', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no6', right: 'no7', relKey: 'no6-no7', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
  { left: 'no7', right: 'no8', relKey: 'no7-no8', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.7)' },
  { left: 'no8', right: 'no9', relKey: 'no8-no9', color: '#a855f7', glowColor: 'rgba(168,85,247,0.7)' },
];

function seatLabel(key: RoomSeatKey): string {
  if (key === 'host') return 'HOST';
  return `NO.${key.replace('no', '')}`;
}

export const WatchTogetherView: React.FC<WatchTogetherViewProps> = ({
  roomDisplayId,
  roomTitle,
  announcement,
  isRoomSaved,
  roomIdCopied,
  onCopyRoomId,
  onToggleSaveRoom,
  watchTogetherMedia: media,
  onLeaveRoom,
  onShareRoom,
  onOpenRoomDetails,
  onOpenRoomEdit,
  activeSeats,
  viewers,
  roomExpProgress,
  roomGiftSummary,
  handleSeatClick,
  handleToggleSeatMic,
  buildViewerFromGuest,
  handleSelectViewer,
  setIsRoomBackgroundMenuOpen,
  setIsRoomViewersOpen,
  setIsGiftPickerOpen,
  setIsGuestManagementOpen,
  liveChatMsgs,
  chatInput,
  handleChatInputChange,
  handleSendMessage,
  handleChatScroll,
  chatScrollRef,
  getMentionSuggestions,
  selectMention,
  mutuallyFollowing,
  toggleHeartbeat,
  renderJoinChatEvent,
  renderSingChatEvent,
  renderGiftChatEvent,
  renderStandardChatMessage,
  mentionSearch,
  onToggleUserMic,
  userSeatKey,
  userMicOn,
  userVoiceActive,
  userMicLevel,
  audioPulse,
  canChangeRoomBackground,
  backgroundMode,
  pendingBackgroundMode,
  arenaParticipants,
  arenaCountdownText,
  onOpenArenaRankings,
  lockedSeats,
  canManageMedia,
  showToast,
  canEditAnnouncement = false,
  onEditAnnouncement,
  canChangeRoomMode = false,
  onOpenRoomModePicker,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackLoadTokenRef = useRef(0);
  const [isMediaSourceOpen, setIsMediaSourceOpen] = useState(false);
  const [playbackMedia, setPlaybackMedia] = useState(media);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isMediaLoading, setIsMediaLoading] = useState(false);

  const canPlayMedia = Boolean(playbackMedia.streamUrl) && !playbackMedia.isHydrating;

  const headerMenuItems = useMemo<RoomHeaderMenuItem[]>(
    () => [
      {
        id: 'details',
        label: 'Room details',
        icon: <Info size={15} aria-hidden />,
        onClick: onOpenRoomDetails,
      },
      {
        id: 'edit',
        label: 'Edit room settings',
        icon: <Settings2 size={15} aria-hidden />,
        onClick: () => onOpenRoomEdit?.(),
        hidden: !onOpenRoomEdit,
      },
      {
        id: 'media',
        label: 'Change room media',
        icon: <Upload size={15} aria-hidden />,
        onClick: () => setIsMediaSourceOpen(true),
        hidden: !canManageMedia,
      },
      {
        id: 'share',
        label: 'Share room',
        icon: <ShareIcon size="room" tone="inherit" className="h-4 w-4" />,
        onClick: onShareRoom,
      },
      {
        id: 'announcement',
        label: 'Edit announcement',
        icon: <Pencil size={15} aria-hidden />,
        onClick: () => onEditAnnouncement?.(),
        hidden: !canEditAnnouncement || !onEditAnnouncement,
      },
    ],
    [
      onOpenRoomDetails,
      onOpenRoomEdit,
      canManageMedia,
      onShareRoom,
      canEditAnnouncement,
      onEditAnnouncement,
    ],
  );

  useEffect(() => {
    setPlaybackMedia(media);
  }, [media]);

  useEffect(() => {
    void hydrateWatchTogetherMedia(roomDisplayId);
  }, [roomDisplayId]);

  useEffect(() => {
    const onMediaUpdated = (event: Event) => {
      const detail = (event as CustomEvent<WatchTogetherMediaUpdateDetail>).detail;
      if (!detail?.roomId || detail.roomId !== roomDisplayId) return;
      setPlaybackMedia(detail.media);
      setPlaybackError(null);
    };
    window.addEventListener('watch-together-media-updated', onMediaUpdated);
    return () => window.removeEventListener('watch-together-media-updated', onMediaUpdated);
  }, [roomDisplayId]);

  useEffect(() => {
    if (!canPlayMedia) {
      setIsMediaLoading(Boolean(playbackMedia.isHydrating));
      setPlaybackError(null);
      return;
    }

    const loadToken = ++playbackLoadTokenRef.current;
    const element = playbackMedia.kind === 'audio' ? audioRef.current : videoRef.current;
    if (!element) return;

    setIsMediaLoading(true);
    setPlaybackError(null);
    element.load();
    void element.play().catch(() => undefined);

    return () => {
      try {
        element.pause();
      } catch {
        /* ignore */
      }
      if (loadToken === playbackLoadTokenRef.current) {
        playbackLoadTokenRef.current += 1;
      }
    };
  }, [canPlayMedia, playbackMedia.streamUrl, playbackMedia.kind, playbackMedia.isHydrating]);

  const handlePlaybackError = () => {
    if (!canPlayMedia) return;
    const message = 'Could not load this media. Try another URL or upload a file.';
    setPlaybackError(message);
    setIsMediaLoading(false);
    showToast(message);
  };

  const handlePlaybackReady = () => {
    setPlaybackError(null);
    setIsMediaLoading(false);
  };

  const handleMediaUpdated = (updated: WatchTogetherMedia) => {
    setPlaybackMedia(updated);
    setPlaybackError(null);
    setIsMediaLoading(true);
  };

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
          <div className="flex flex-col items-center w-full">
            <div className="relative overflow-visible">
              <SeatSpeakingLevelBars active={voiceVisualActive} audioPulse={voicePulse} />
              <button
                type="button"
                onClick={() => handleSeatClick(key)}
                className={
                  isHost
                    ? 'party-host-avatar relative rounded-full p-[2px] cursor-pointer hover:scale-105 transition-transform bg-gradient-to-tr from-cyan-400 via-purple-600 to-pink-500 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                    : `party-guest-avatar relative rounded-full p-[2px] cursor-pointer hover:scale-105 transition-transform ${getSeatFrameClasses(occupant.frameStyle)}`
                }
              >
                <img
                  src={occupant.avatar}
                  className="w-full h-full rounded-full object-cover border-2 border-[#050510]"
                  alt={occupant.name}
                />
              </button>
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
                isHost ? 'party-host-name text-cyan-300 hover:text-cyan-100' : 'party-seat-name text-gray-200 hover:text-pink-300'
              } font-bold mt-1.5 truncate w-full text-center drop-shadow-sm hover:underline transition`}
            >
              {truncateName(occupant.name, isHost ? 12 : 10)}
            </button>

            <div
              className={`party-seat-stars flex items-center space-x-0.5 px-1.5 py-[2px] rounded-full border mt-1 shadow-sm ${
                isHost
                  ? 'bg-cyan-950/80 border-cyan-400/40'
                  : 'bg-black/75 border-white/10'
              }`}
            >
              <Star size={8} className="fill-yellow-400 text-yellow-400" />
              <span className="text-[9px] font-black text-yellow-300 font-mono leading-none">
                {occupant.stars.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center relative">
            <button
              type="button"
              onClick={() => handleSeatClick(key)}
              disabled={isLocked}
              className={`party-empty-seat rounded-full flex items-center justify-center transition transform active:scale-95 shadow-inner cursor-pointer ${
                isLocked
                  ? 'bg-red-950/50 border border-red-500/40 text-red-400 hover:border-red-500/60'
                  : isHost
                    ? 'bg-white/10 border border-cyan-400/30 text-cyan-200/80 hover:border-cyan-300/50'
                    : 'bg-[#3d2c25]/80 border border-[#6b4c3e]/40 text-[#d2a38b] hover:text-white hover:border-pink-500/40'
              }`}
              aria-label={isLocked ? `${seatLabel(key)} locked` : `Take ${seatLabel(key)}`}
            >
              {isLocked ? (
                <Lock size={14} className="text-red-400" />
              ) : (
                <Sofa size={18} strokeWidth={2.2} />
              )}
            </button>
            <span className="text-[10px] font-black mt-1.5 tracking-wider uppercase inline-flex items-center space-x-1">
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
    <div className="watch-together-layout relative flex h-full min-h-0 flex-1 flex-col w-full overflow-hidden font-sans">
      <RoomBackgroundLayer mode={pendingBackgroundMode ?? backgroundMode} />
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col w-full bg-transparent overflow-hidden">
      <div className="watch-together-stage relative z-20 flex min-h-0 shrink flex-col overflow-x-hidden overflow-y-auto scrollbar-hide">
      <header className="watch-together-header relative z-50 flex shrink-0 flex-col gap-1 bg-gradient-to-b from-black/90 to-transparent px-3 pb-1 pt-2 sm:px-4 sm:pt-3">
        <div className="flex items-center justify-between gap-2">
          <RoomLiveHeaderInfo
            roomLevel={roomExpProgress.level}
            roomTitle={roomTitle}
            announcement={announcement}
            roomDisplayId={roomDisplayId}
            isRoomSaved={isRoomSaved}
            roomIdCopied={roomIdCopied}
            onOpenDetails={onOpenRoomDetails}
            onCopyRoomId={onCopyRoomId}
            onToggleSaveRoom={onToggleSaveRoom}
            canEditAnnouncement={canEditAnnouncement}
            onEditAnnouncement={onEditAnnouncement}
            className="max-w-[62%] sm:max-w-none"
          />

          <div className="flex shrink-0 items-center space-x-1.5 sm:space-x-2">
            <button
              type="button"
              onClick={() => setIsRoomViewersOpen(true)}
              aria-label={`${viewers.length} viewers in room`}
              className="party-viewers-chip flex min-h-[32px] cursor-pointer items-center space-x-2 rounded-full px-2.5 py-1.5 backdrop-blur-md transition hover:bg-white/10 sm:px-3"
            >
              <div className="-space-x-2 mr-0.5 flex">
                {viewers.slice(0, 3).map((v) => (
                  <img
                    key={v.id}
                    src={v.avatar}
                    className="rounded-full border-2 border-[#07010a] object-cover"
                    alt=""
                  />
                ))}
              </div>
              <div className="flex items-center space-x-1.5 opacity-90">
                <Users size={16} className="text-gray-300" />
                <span className="party-viewers-count font-black text-gray-100">{viewers.length}</span>
              </div>
            </button>
            <RoomHeaderActionsMenu items={headerMenuItems} />
            <button
              type="button"
              onClick={onLeaveRoom}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-gray-300 transition hover:border-red-500/40 hover:bg-red-500/20 hover:text-red-200 active:scale-90 sm:h-9 sm:w-9"
              aria-label="Leave room"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            type="button"
            onClick={onOpenRoomDetails}
            className="flex shrink-0 items-center rounded-full px-2 py-0.5 text-[8.5px] font-bold text-teal-400 backdrop-blur transition hover:bg-purple-950/20 active:scale-95"
            title={`Today ${roomExpProgress.todayExp}/${roomExpProgress.dailyCap} EXP`}
          >
            <span>
              EXP {roomExpProgress.todayExp}/{roomExpProgress.dailyCap}
              {roomExpProgress.todayOverDailyTarget ? '+' : ''}
            </span>
            <ChevronRight size={8} className="ml-0.5 text-teal-500" />
          </button>
          <button
            type="button"
            onClick={() => setIsGiftPickerOpen(true)}
            className="flex shrink-0 items-center rounded-full border border-pink-500/20 bg-[#240c1e]/80 px-2 py-0.5 text-[8.5px] font-bold text-pink-400 backdrop-blur transition hover:bg-pink-950/20 active:scale-95"
            title={`${roomGiftSummary.giftCount.toLocaleString()} gifts received in this room`}
          >
            <Star size={8} className="mr-0.5 fill-pink-400 text-pink-400" />
            <span>{roomGiftSummary.totalStars.toLocaleString()}</span>
            <ChevronRight size={8} className="ml-0.5 text-pink-400" />
          </button>
        </div>
      </header>

      <div className="watch-together-player relative z-20 shrink-0">
        <div className="watch-together-player-frame w-full overflow-hidden bg-black relative">
          {playbackMedia.kind === 'audio' ? (
            <>
              <img
                src={playbackMedia.posterUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-45 pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20 pointer-events-none" />
              <div className="relative z-10 flex h-full w-full flex-col items-center justify-end p-3 pb-4">
                <div className="pointer-events-none mb-auto flex w-full items-start pt-2">
                  <span className="rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-pink-200 border border-white/10">
                    Watch Together
                  </span>
                </div>
                {playbackError ? (
                  <p className="mb-3 px-3 text-center text-[11px] font-bold text-red-300">{playbackError}</p>
                ) : null}
                {isMediaLoading && !playbackError ? (
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    {playbackMedia.isHydrating ? 'Preparing upload…' : 'Loading audio…'}
                  </p>
                ) : null}
                {canPlayMedia ? (
                  <audio
                    ref={audioRef}
                    key={playbackMedia.streamUrl}
                    src={playbackMedia.streamUrl}
                    controls
                    controlsList="nodownload"
                    preload="auto"
                    onLoadedData={handlePlaybackReady}
                    onCanPlay={handlePlaybackReady}
                    onError={handlePlaybackError}
                    className="watch-together-native-media w-full max-w-full"
                  />
                ) : null}
              </div>
            </>
          ) : (
            <>
              {canPlayMedia ? (
                <video
                  ref={videoRef}
                  key={playbackMedia.streamUrl}
                  src={playbackMedia.streamUrl}
                  poster={playbackMedia.posterUrl}
                  controls
                  controlsList="nodownload"
                  playsInline
                  preload="auto"
                  onLoadedData={handlePlaybackReady}
                  onCanPlay={handlePlaybackReady}
                  onError={handlePlaybackError}
                  className="watch-together-native-media h-full w-full bg-black object-contain"
                />
              ) : (
                <img
                  src={playbackMedia.posterUrl}
                  alt=""
                  className="h-full w-full bg-black object-contain opacity-60"
                />
              )}
              <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2">
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-pink-200 border border-white/10">
                  Watch Together
                </span>
              </div>
              {isMediaLoading && !playbackError ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/35">
                  <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white/80">
                    {playbackMedia.isHydrating ? 'Preparing upload…' : 'Loading…'}
                  </span>
                </div>
              ) : null}
              {playbackError ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/75 px-4 text-center">
                  <p className="text-xs font-bold text-red-300">{playbackError}</p>
                  {canManageMedia ? (
                    <button
                      type="button"
                      onClick={() => setIsMediaSourceOpen(true)}
                      className="rounded-full border border-pink-500/40 bg-pink-600/20 px-3 py-1 text-[10px] font-black text-pink-200 hover:bg-pink-600/30"
                    >
                      Change media source
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="watch-together-seats relative z-20 shrink-0 px-1">
        <div className="watch-together-seat-grid-5">
          <SeatHeartbeatRowOverlay
            segments={WATCH_TOGETHER_HEARTBEAT_ROW1}
            mutuallyFollowing={mutuallyFollowing}
            activeSeats={activeSeats}
            onToggle={toggleHeartbeat}
            slotClassPrefix="watch-together-heartbeat-slot"
          />
          {WATCH_TOGETHER_ROW1.map((key) => renderSeat(key))}
        </div>
        <div className="watch-together-seat-grid-5">
          <SeatHeartbeatRowOverlay
            segments={WATCH_TOGETHER_HEARTBEAT_ROW2}
            mutuallyFollowing={mutuallyFollowing}
            activeSeats={activeSeats}
            onToggle={toggleHeartbeat}
            slotClassPrefix="watch-together-heartbeat-slot"
          />
          {WATCH_TOGETHER_ROW2.map((key) => renderSeat(key))}
        </div>
      </div>
      </div>

      <div className="watch-together-conversation relative z-30 flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        id="chat_and_action_container"
        className="party-chat-grid room-conversation flex min-h-0 flex-1 overflow-hidden px-3 sm:px-4 pt-1 pb-0"
      >
      <div className="watch-together-chat relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-1 pb-1">
        <div
          ref={chatScrollRef}
          onScroll={handleChatScroll}
          className="watch-together-chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hide"
        >
          <div className="watch-together-chat-feed mt-auto flex w-full flex-col items-start gap-2 pb-1 pt-0.5">
            <div className="watch-together-chat-item flex w-full justify-start">
              <div className="flex items-center space-x-2.5 bg-black/20 backdrop-blur-md px-3.5 py-1.5 rounded-full w-fit max-w-full border border-white/5 shadow-md">
                <div className="w-5 h-5 shrink-0 bg-[#00f7ff] rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(0,247,255,0.5)] border border-white/20">
                  <Users size={12} className="text-black" />
                </div>
                <span className="text-[10px] font-black text-[#00f7ff] uppercase tracking-tight truncate">
                  {roomTitle}
                </span>
                <div className="flex items-center space-x-1.5 text-[10px] text-blue-400 font-bold shrink-0">
                  <Video size={10} className="fill-blue-400" />
                  <span>{viewers.length}</span>
                </div>
              </div>
            </div>

            {liveChatMsgs.map((msg, idx) => {
              const messageId = msg.id ?? idx;

              const wrapFeedItem = (node: React.ReactNode) => (
                <div key={messageId} className="watch-together-chat-item flex w-full justify-start text-left">
                  {node}
                </div>
              );

              if (msg.isSystem) {
                return wrapFeedItem(
                  <div className="mx-0 w-fit max-w-full rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3 py-1 text-center text-[10px] font-bold text-cyan-200/90">
                    {msg.text}
                  </div>,
                );
              }

              if (msg.isSingEvent) {
                return wrapFeedItem(renderSingChatEvent({ ...msg, id: messageId }));
              }

              if (msg.isJoinEvent) {
                return wrapFeedItem(renderJoinChatEvent({ ...msg, id: messageId }));
              }

              if (msg.isGiftEvent) {
                return wrapFeedItem(renderGiftChatEvent({ ...msg, id: messageId }));
              }

              return wrapFeedItem(
                renderStandardChatMessage(
                  { ...msg, id: messageId },
                  {
                    layout: 'inline',
                    bubbleClassName: 'bg-black/30 backdrop-blur-xl border border-white/5 shadow-sm',
                  },
                ),
              );
            })}
          </div>
        </div>
      </div>

      <RoomArenaColumn
        participants={arenaParticipants}
        countdownText={arenaCountdownText}
        onOpen={onOpenArenaRankings}
      />
      </div>

      <div
        id="watch-together-footer"
        className="watch-together-footer z-50 shrink-0 border-t border-white/5 bg-black/30 backdrop-blur-xl pt-2 pb-[max(10px,env(safe-area-inset-bottom))] px-2 sm:px-4"
      >
        <div className="watch-together-footer-row flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <form onSubmit={handleSendMessage} className="relative min-w-0 w-full sm:flex-1">
            {mentionSearch !== null && (
              <div className="absolute bottom-full left-0 mb-2 w-44 bg-[#1a0f2e]/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-lg overflow-hidden z-[100]">
                <div className="max-h-40 overflow-y-auto scrollbar-hide py-1">
                  {getMentionSuggestions().length > 0 ? (
                    getMentionSuggestions().map((user, index) => (
                      <button
                        key={`${user.name}-${index}`}
                        type="button"
                        onClick={() => selectMention(user.name)}
                        className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-white/10 text-left"
                      >
                        <img src={user.avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                        <span className="text-xs font-bold text-gray-200 truncate">{user.name}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-[10px] text-gray-500 text-center">No users found</div>
                  )}
                </div>
              </div>
            )}
            <input
              type="text"
              value={chatInput}
              onChange={(e) => handleChatInputChange(e.target.value)}
              placeholder="Say Hi..."
              className="w-full min-w-0 bg-white/5 border border-white/10 rounded-full py-2.5 pl-4 pr-10 text-[12.5px] text-white font-bold placeholder:text-white/30 outline-none focus:border-pink-500/50"
            />
            {chatInput.trim() && (
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-pink-500"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            )}
          </form>

          <div className="watch-together-footer-actions flex w-full min-w-0 shrink-0 items-center justify-between gap-1 overflow-x-auto scrollbar-hide sm:w-auto sm:justify-end sm:gap-1.5">
            <button
              type="button"
              onClick={onToggleUserMic}
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border transition active:scale-90 ${
                userSeatKey && userMicOn
                  ? userVoiceActive
                    ? 'border-cyan-400/60 bg-cyan-500/25 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.45)] animate-pulse'
                    : 'border-cyan-400/40 bg-cyan-500/20 text-cyan-200'
                  : 'border-white/10 bg-white/10 text-white/70'
              }`}
              aria-label={userMicOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {userMicOn ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsGuestManagementOpen(true)}
              title="Join a seat and guest management"
              aria-label="Join a seat and guest management"
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 transition hover:bg-white/15 active:scale-90"
            >
              <Users size={16} />
            </button>
            {canChangeRoomMode && onOpenRoomModePicker ? (
              <button
                type="button"
                onClick={onOpenRoomModePicker}
                title="Change room mode"
                aria-label="Change room mode"
                className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 transition hover:bg-white/15 active:scale-90"
              >
                <LayoutGrid size={16} />
              </button>
            ) : null}
            {canChangeRoomBackground && (
              <button
                type="button"
                onClick={() => setIsRoomBackgroundMenuOpen(true)}
                title="Change room background"
                aria-label="Change room background"
                className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 transition hover:bg-white/15 active:scale-90"
              >
                <Menu size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsGiftPickerOpen(true)}
              className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-tr from-pink-500 to-yellow-400 p-px transition active:scale-90"
              aria-label="Send gift"
            >
              <div className="flex h-full w-full items-center justify-center rounded-[9px] bg-[#0d011c]">
                <Gift size={16} className="text-yellow-400" />
              </div>
            </button>
          </div>
        </div>
      </div>
      </div>

      <WatchTogetherMediaSourceSheet
        isOpen={isMediaSourceOpen}
        onClose={() => setIsMediaSourceOpen(false)}
        roomDisplayId={roomDisplayId}
        media={playbackMedia}
        showToast={showToast}
        onMediaUpdated={handleMediaUpdated}
      />
      </div>
    </div>
  );
};

import React, { type RefObject } from 'react';
import { ChevronRight, Gamepad2, LogOut, Send, Users, Video } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import { safeAvatarUrl } from '../../lib/safe';
import type { RoomExpProgress } from '../utils/roomExp';
import type { RoomGiftSummary } from '../utils/roomGifts';
import type { RoomViewerEntry } from '../utils/roomViewers';
import type { PartySeatMap, RoomGuest } from '../utils/roomSeats';
import { createEmptyPartySeats } from '../utils/roomSeats';
import type { RoomBackgroundMode } from '../utils/roomBackground';
import { RoomBackgroundLayer } from './RoomBackgroundLayer';
import { RoomLiveHeaderInfo } from './RoomLiveHeaderInfo';
import type { HostLiveMetrics } from './HostLiveMetricsStrip';
import { RoomFooterTrayActions } from './RoomFooterTrayActions';
import { RoomHeaderActionsMenu, type RoomHeaderMenuItem } from './RoomHeaderActionsMenu';
import { RoomHeaderYoutubeMiniButton } from './RoomHeaderYoutubeMiniButton';
import { RoomArenaColumn } from './RoomArenaLeaderboard';
import type { ArenaLeaderboardParticipant } from './RoomArenaLeaderboard';
import { WatchTogetherSeatStrip } from './WatchTogetherSeatStrip';

type LiveChatMsg = {
  id?: number | string;
  text?: string;
  isJoinEvent?: boolean;
  isGiftEvent?: boolean;
  isSystem?: boolean;
  isSingEvent?: 'start' | 'end';
  isAnnouncementWelcome?: boolean;
  user?: string;
  userId?: string;
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

export type GameLiveViewerWatchLayoutProps = {
  roomDisplayId: string;
  roomTitle: string;
  announcement: string;
  hostLiveMetrics?: HostLiveMetrics | null;
  isRoomSaved: boolean;
  roomIdCopied: boolean;
  onCopyRoomId: (event: React.MouseEvent) => void;
  onToggleSaveRoom: (event: React.MouseEvent) => void;
  onLeaveRoom: () => void;
  onOpenRoomDetails: () => void;
  activeSeats?: PartySeatMap;
  handleSeatClick: (seatKey: string) => void;
  handleToggleSeatMic: (key: string) => void;
  buildViewerFromGuest: (guest: RoomGuest, seatKey: string) => ChatViewerPayload;
  handleSelectViewer: (viewer: ChatViewerPayload) => void;
  lockedSeats?: Record<string, boolean>;
  mutuallyFollowing?: Record<string, boolean>;
  toggleHeartbeat?: (key1: string, key2: string) => void;
  userMicLevel?: number;
  audioPulse?: number;
  viewerUserId?: string;
  viewers: RoomViewerEntry[];
  roomExpProgress: RoomExpProgress;
  roomGiftSummary: RoomGiftSummary;
  setIsRoomViewersOpen: (open: boolean) => void;
  setIsGiftPickerOpen: (open: boolean) => void;
  onOpenStickers?: () => void;
  stickersOpen?: boolean;
  setIsGuestManagementOpen: (open: boolean) => void;
  liveChatMsgs: LiveChatMsg[];
  chatInput: string;
  handleChatInputChange: (val: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  handleChatScroll: () => void;
  chatScrollRef: RefObject<HTMLDivElement | null>;
  getMentionSuggestions: () => Array<{ name: string; avatar: string }>;
  selectMention: (name: string) => void;
  renderJoinChatEvent: (message: LiveChatMsg & { id: string | number }) => React.ReactNode;
  renderSingChatEvent: (message: LiveChatMsg & { id: string | number }) => React.ReactNode;
  renderGiftChatEvent: (message: LiveChatMsg & { id: string | number }) => React.ReactNode;
  renderAnnouncementWelcome: (message: LiveChatMsg & { id: string | number }) => React.ReactNode;
  renderStandardChatMessage: (
    message: LiveChatMsg & { id: string | number },
    options?: { bubbleClassName?: string; layout?: 'stacked' | 'inline' },
  ) => React.ReactNode;
  mentionSearch: string | null;
  onToggleUserMic: () => void;
  onToggleSeatParticipation: () => void;
  guestManagementOpen?: boolean;
  userSeatKey: string | null;
  userMicOn: boolean;
  userVoiceActive: boolean;
  backgroundMode: RoomBackgroundMode;
  pendingBackgroundMode: RoomBackgroundMode | null;
  arenaParticipants: ArenaLeaderboardParticipant[];
  arenaCountdownText?: string;
  onOpenArenaRankings: () => void;
  canEditAnnouncement?: boolean;
  onEditAnnouncement?: () => void;
  showVoiceChanger?: boolean;
  voiceChangerEligible?: boolean;
  voiceChangerOpen?: boolean;
  voiceEffectActive?: boolean;
  voiceEffectEmoji?: string;
  onToggleVoiceChanger?: () => void;
  onOpenGiftSenders: (receiver: { name: string; userId?: string }) => void;
  onOpenGame?: () => void;
  /** In-app Games (not Game Live casting / trivia). */
  onGameClick?: () => void;
  gamePhase?: string;
  headerMenuItems: RoomHeaderMenuItem[];
  remoteScreenVideoRef: RefObject<HTMLVideoElement | null>;
  remoteCameraVideoRef: RefObject<HTMLVideoElement | null>;
  hasRemoteCast: boolean;
  hasRemoteCamera: boolean;
};

export function GameLiveViewerWatchLayout({
  roomDisplayId,
  roomTitle,
  announcement,
  hostLiveMetrics = null,
  isRoomSaved,
  roomIdCopied,
  onCopyRoomId,
  onToggleSaveRoom,
  onLeaveRoom,
  onOpenRoomDetails,
  activeSeats,
  handleSeatClick,
  handleToggleSeatMic,
  buildViewerFromGuest,
  handleSelectViewer,
  lockedSeats = {},
  mutuallyFollowing = {},
  toggleHeartbeat,
  userMicLevel = 0,
  audioPulse = 0,
  viewerUserId,
  viewers,
  roomExpProgress,
  roomGiftSummary,
  setIsRoomViewersOpen,
  setIsGiftPickerOpen,
  onOpenStickers,
  stickersOpen = false,
  setIsGuestManagementOpen,
  liveChatMsgs,
  chatInput,
  handleChatInputChange,
  handleSendMessage,
  handleChatScroll,
  chatScrollRef,
  getMentionSuggestions,
  selectMention,
  renderJoinChatEvent,
  renderSingChatEvent,
  renderGiftChatEvent,
  renderAnnouncementWelcome,
  renderStandardChatMessage,
  mentionSearch,
  onToggleUserMic,
  onToggleSeatParticipation,
  guestManagementOpen = false,
  userSeatKey,
  userMicOn,
  userVoiceActive,
  backgroundMode,
  pendingBackgroundMode,
  arenaParticipants,
  arenaCountdownText,
  onOpenArenaRankings,
  canEditAnnouncement = false,
  onEditAnnouncement,
  showVoiceChanger = false,
  voiceChangerEligible = false,
  voiceChangerOpen = false,
  voiceEffectActive = false,
  voiceEffectEmoji,
  onToggleVoiceChanger,
  onOpenGiftSenders,
  onOpenGame,
  onGameClick,
  gamePhase = 'idle',
  headerMenuItems,
  remoteScreenVideoRef,
  remoteCameraVideoRef,
  hasRemoteCast,
  hasRemoteCamera,
}: GameLiveViewerWatchLayoutProps) {
  const seats = activeSeats ?? createEmptyPartySeats();

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
                hostLiveMetrics={hostLiveMetrics}
                className="max-w-[62%] sm:max-w-none"
              />

              <div className="flex shrink-0 items-center space-x-1.5 sm:space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRoomViewersOpen(true)}
                  aria-label={`${viewers.length} viewers in room`}
                  className="party-viewers-chip party-glass-chip flex min-h-[32px] cursor-pointer items-center space-x-2 rounded-full px-2.5 py-1.5 sm:px-3 transition"
                >
                  <div className="-space-x-2 mr-0.5 flex">
                    {viewers.slice(0, 3).map((v) => (
                      <img
                        key={v.id}
                        src={safeAvatarUrl(v.avatar)}
                        className="h-6 w-6 shrink-0 rounded-full border-2 border-[#07010a] object-cover sm:h-7 sm:w-7"
                        alt=""
                      />
                    ))}
                  </div>
                  <div className="flex items-center space-x-1.5 opacity-90">
                    <Users size={16} className="text-gray-300" />
                    <span className="party-viewers-count font-black text-gray-100">{viewers.length}</span>
                  </div>
                </button>
                <RoomHeaderYoutubeMiniButton />
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
                <CoinIcon className="mr-0.5 h-2 w-2 shrink-0" />
                <span>{roomGiftSummary.totalStars.toLocaleString()}</span>
                <ChevronRight size={8} className="ml-0.5 text-pink-400" />
              </button>
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-950/40 px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wide text-emerald-200">
                <Gamepad2 size={10} />
                Game Live
              </span>
              {onOpenGame ? (
                <button
                  type="button"
                  onClick={() => onOpenGame()}
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wide transition active:scale-95 ${
                    gamePhase === 'active'
                      ? 'border-violet-400/50 bg-violet-950/50 text-violet-200'
                      : 'border-white/10 bg-black/30 text-white/70 hover:bg-white/10'
                  }`}
                >
                  Trivia
                </button>
              ) : null}
            </div>
          </header>

          <div className="watch-together-player relative z-20 shrink-0">
            <div className="watch-together-player-frame relative w-full overflow-hidden bg-black">
              {hasRemoteCast ? (
                <video
                  ref={remoteScreenVideoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 h-full w-full bg-black object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50">
                    <Gamepad2 size={26} />
                  </div>
                  <p className="text-sm font-black text-white/90">Waiting for host to start the game</p>
                  <p className="text-[11px] font-medium text-white/45">
                    The stream will appear here automatically.
                  </p>
                </div>
              )}

              <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/55 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200">
                  Game Live
                </span>
              </div>

              {hasRemoteCamera ? (
                <div className="absolute bottom-2 right-2 z-20 h-[4.25rem] w-[5.5rem] overflow-hidden rounded-xl border-2 border-white/25 bg-[#111] shadow-[0_8px_28px_rgba(0,0,0,0.55)] sm:h-[5.25rem] sm:w-[7rem]">
                  <video
                    ref={remoteCameraVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[7px] font-black uppercase text-white">
                    Host
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <WatchTogetherSeatStrip
            layout="gameLive"
            roomDisplayId={roomDisplayId}
            viewerUserId={viewerUserId}
            activeSeats={seats}
            lockedSeats={lockedSeats}
            handleSeatClick={handleSeatClick}
            handleToggleSeatMic={handleToggleSeatMic}
            buildViewerFromGuest={buildViewerFromGuest}
            handleSelectViewer={handleSelectViewer}
            onOpenGiftSenders={onOpenGiftSenders}
            mutuallyFollowing={mutuallyFollowing}
            toggleHeartbeat={toggleHeartbeat}
            userSeatKey={userSeatKey}
            userMicOn={userMicOn}
            userVoiceActive={userVoiceActive}
            userMicLevel={userMicLevel}
            audioPulse={audioPulse}
          />
        </div>

        <div className="watch-together-conversation relative z-30 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            id="chat_and_action_container"
            className="party-chat-grid room-conversation flex min-h-0 flex-1 overflow-hidden px-3 pt-1 pb-0 sm:px-4"
          >
            <div className="watch-together-chat relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-1 pb-1">
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="watch-together-chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hide"
              >
                <div className="watch-together-chat-feed mt-auto flex w-full flex-col items-start gap-2 pb-1 pt-0.5">
                  <div className="watch-together-chat-item flex w-full justify-start">
                    <div className="flex w-fit max-w-full items-center space-x-2.5 rounded-full border border-white/5 bg-black/20 px-3.5 py-1.5 shadow-md backdrop-blur-md">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#00f7ff] shadow-[0_0_12px_rgba(0,247,255,0.5)]">
                        <Users size={12} className="text-black" />
                      </div>
                      <span className="truncate text-[10px] font-black uppercase tracking-tight text-[#00f7ff]">
                        {roomTitle}
                      </span>
                      <div className="flex shrink-0 items-center space-x-1.5 text-[10px] font-bold text-blue-400">
                        <Video size={10} className="fill-blue-400" />
                        <span>{viewers.length}</span>
                      </div>
                    </div>
                  </div>

                  {liveChatMsgs.map((msg, idx) => {
                    const messageId = msg.id ?? idx;
                    const wrapFeedItem = (node: React.ReactNode) => (
                      <div
                        key={messageId}
                        className="watch-together-chat-item flex w-full justify-start text-left"
                      >
                        {node}
                      </div>
                    );

                    if (msg.isAnnouncementWelcome) {
                      return wrapFeedItem(renderAnnouncementWelcome({ ...msg, id: messageId }));
                    }
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
              countdownText={arenaCountdownText ?? '--:--'}
              onOpen={onOpenArenaRankings}
            />
          </div>

          <div
            id="watch-together-footer"
            className="watch-together-footer z-50 shrink-0 border-t border-white/5 bg-black/30 px-2 pb-[max(10px,var(--app-composer-bottom-inset))] pt-2 backdrop-blur-xl sm:px-4"
          >
            <div className="watch-together-footer-row flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <form onSubmit={handleSendMessage} className="relative min-w-0 w-full sm:flex-1">
                {mentionSearch !== null ? (
                  <div className="absolute bottom-full left-0 z-[100] mb-2 w-44 overflow-hidden rounded-2xl border border-purple-500/30 bg-[#1a0f2e]/95 shadow-lg backdrop-blur-xl">
                    <div className="max-h-40 overflow-y-auto py-1 scrollbar-hide">
                      {getMentionSuggestions().length > 0 ? (
                        getMentionSuggestions().map((user, index) => (
                          <button
                            key={`${user.name}-${index}`}
                            type="button"
                            onClick={() => selectMention(user.name)}
                            className="flex w-full items-center space-x-2 px-3 py-2 text-left hover:bg-white/10"
                          >
                            <img
                              src={safeAvatarUrl(user.avatar)}
                              className="h-6 w-6 rounded-full object-cover"
                              alt=""
                            />
                            <span className="truncate text-xs font-bold text-gray-200">{user.name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-center text-[10px] text-gray-500">No users found</div>
                      )}
                    </div>
                  </div>
                ) : null}
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => handleChatInputChange(e.target.value)}
                  placeholder="Say Hi..."
                  className="party-glass-input w-full min-w-0 rounded-full py-2.5 pl-4 pr-10 text-[12.5px] font-bold text-white placeholder:text-white/30"
                />
                {chatInput.trim() ? (
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-pink-500"
                    aria-label="Send message"
                  >
                    <Send size={14} />
                  </button>
                ) : null}
              </form>

              <RoomFooterTrayActions
                userSeatKey={userSeatKey}
                userMicOn={userMicOn}
                userVoiceActive={userVoiceActive}
                onToggleUserMic={onToggleUserMic}
                onToggleSeatParticipation={onToggleSeatParticipation}
                onOpenGuestManagement={() => setIsGuestManagementOpen(true)}
                guestManagementOpen={guestManagementOpen}
                onOpenGiftPicker={() => setIsGiftPickerOpen(true)}
                onOpenStickers={onOpenStickers}
                stickersOpen={stickersOpen}
                onGameClick={onGameClick}
                micAccent="cyan"
                showVoiceChanger={showVoiceChanger}
                voiceChangerEligible={voiceChangerEligible}
                voiceChangerOpen={voiceChangerOpen}
                voiceEffectActive={voiceEffectActive}
                voiceEffectEmoji={voiceEffectEmoji}
                onToggleVoiceChanger={onToggleVoiceChanger}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

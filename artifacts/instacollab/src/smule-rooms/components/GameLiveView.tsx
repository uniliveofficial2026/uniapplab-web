import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Crown,
  Eye,
  EyeOff,
  Gamepad2,
  GripVertical,
  Info,
  LayoutGrid,
  LogOut,
  MessageCircle,
  MessageCircleOff,
  Monitor,
  Pencil,
  Send,
  Settings2,
  Shield,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import type { RoomExpProgress } from '../utils/roomExp';
import type { RoomGiftSummary } from '../utils/roomGifts';
import type { RoomViewerEntry } from '../utils/roomViewers';
import type { PartySeatMap, RoomGuest } from '../utils/roomSeats';
import type { RoomBackgroundMode } from '../utils/roomBackground';
import { safeAvatarUrl } from '../../lib/safe';
import { RoomBackgroundLayer } from './RoomBackgroundLayer';
import { RoomLiveHeaderInfo } from './RoomLiveHeaderInfo';
import { RoomFooterTrayActions } from './RoomFooterTrayActions';
import {
  RoomHeaderActionsMenu,
  createRoomBackgroundHeaderMenuItem,
  createSingHeaderMenuItem,
  createYoutubeMiniHeaderMenuItem,
  type RoomHeaderMenuItem,
} from './RoomHeaderActionsMenu';
import { RoomHeaderYoutubeMiniButton } from './RoomHeaderYoutubeMiniButton';
import { ShareIcon } from '../../components/common/ShareIcon';
import { RoomArenaOpenButton } from './RoomArenaLeaderboard';
import type { ArenaLeaderboardParticipant } from './RoomArenaLeaderboard';
import { RoomOwnerSocialControls } from './RoomOwnerSocialControls';
import { useGameLiveKit } from '../hooks/useGameLiveKit';
import { useMultiGuestCameraEffects } from '../hooks/useMultiGuestCameraEffects';
import { usePercentOverlayDrag } from '../hooks/usePercentOverlayDrag';
import { LiveBeautySheet } from './LiveBeautySheet';
import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import type { BodyShapeParams } from '../../lib/ar/bodyShape';
import type { TencentEffectSelection } from '../../lib/webar/webarTypes';
import { isTencentWebARConfigured } from '../../lib/webar/webarConfig';
import {
  clampGameLiveEdgePosition,
  type CommerceCardPosition,
  type GameLiveState,
} from '../utils/liveRoomTypes';

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

const DEFAULT_PIP_POSITION: CommerceCardPosition = { x: 86, y: 30 };
const DEFAULT_CHAT_POSITION: CommerceCardPosition = { x: 50, y: 78 };
const DEFAULT_VIEWERS_POSITION: CommerceCardPosition = { x: 16, y: 26 };
const DEFAULT_TOOLS_DOCK_POSITION: CommerceCardPosition = { x: 92, y: 12 };

type GameLiveLayout = {
  pip: CommerceCardPosition;
  chat: CommerceCardPosition;
  viewers: CommerceCardPosition;
  toolsDock: CommerceCardPosition;
};

function readStoredLayout(roomId: string): Partial<GameLiveLayout> {
  try {
    const raw = sessionStorage.getItem(`game-live-layout:${roomId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<GameLiveLayout> & {
      menu?: CommerceCardPosition;
      chatToggle?: CommerceCardPosition;
      viewersToggle?: CommerceCardPosition;
    };
    return {
      pip: parsed.pip,
      chat: parsed.chat,
      viewers: parsed.viewers,
      toolsDock:
        parsed.toolsDock ?? parsed.menu ?? parsed.viewersToggle ?? parsed.chatToggle,
    };
  } catch {
    return {};
  }
}

function writeStoredLayout(roomId: string, layout: GameLiveLayout) {
  try {
    sessionStorage.setItem(`game-live-layout:${roomId}`, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

function percentOverlayStyle(position: CommerceCardPosition, zIndex: number): React.CSSProperties {
  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
    transform: 'translate(-50%, -50%)',
    zIndex,
    touchAction: 'none',
  };
}

type ChatViewerPayload = {
  id: string;
  name: string;
  avatar: string;
  isOwner: boolean;
  isCoOwner?: boolean;
  isAdmin: boolean;
  isFollowing: boolean;
};

export type GameLiveViewProps = {
  roomDisplayId: string;
  roomTitle: string;
  announcement: string;
  isRoomSaved: boolean;
  roomIdCopied: boolean;
  onCopyRoomId: (event: React.MouseEvent) => void;
  onToggleSaveRoom: (event: React.MouseEvent) => void;
  hostUserId: string;
  isSelfHost: boolean;
  onLeaveRoom: () => void;
  onShareRoom: () => void;
  onOpenRoomDetails: () => void;
  onOpenRoomEdit?: () => void;
  activeSeats?: PartySeatMap;
  handleSeatClick?: (seatKey: string) => void;
  buildViewerFromGuest?: (guest: RoomGuest, seatKey: string) => ChatViewerPayload;
  handleSelectViewer?: (viewer: ChatViewerPayload) => void;
  ownerSocial?: {
    ownerIdentity: { name: string; avatarUrl: string };
    starCount: number;
    isFollowingOwner: boolean;
    toggleFollowOwner: () => void;
    isSelfOwner: boolean;
    ownerViewerPayload: ChatViewerPayload;
  };
  viewers: RoomViewerEntry[];
  roomExpProgress: RoomExpProgress;
  roomGiftSummary: RoomGiftSummary;
  setIsRoomBackgroundMenuOpen: (open: boolean) => void;
  setIsRoomViewersOpen: (open: boolean) => void;
  onSelectViewer?: (viewer: RoomViewerEntry) => void;
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
  canChangeRoomBackground: boolean;
  backgroundMode: RoomBackgroundMode;
  pendingBackgroundMode: RoomBackgroundMode | null;
  arenaParticipants: ArenaLeaderboardParticipant[];
  onOpenArenaRankings: () => void;
  showToast: (message: string) => void;
  canEditAnnouncement?: boolean;
  onEditAnnouncement?: () => void;
  canChangeRoomMode?: boolean;
  onOpenRoomModePicker?: () => void;
  onOpenSing?: () => void;
  hasActiveSong?: boolean;
  songQueueLength?: number;
  hideSingMenu?: boolean;
  processedAudioTrack?: MediaStreamTrack | null;
  voiceMicPublishing?: boolean;
  showVoiceChanger?: boolean;
  voiceChangerEligible?: boolean;
  voiceChangerOpen?: boolean;
  voiceEffectActive?: boolean;
  voiceEffectEmoji?: string;
  onToggleVoiceChanger?: () => void;
  onOpenGiftSenders?: (receiver: { name: string; userId?: string }) => void;
  onOpenGame?: () => void;
  gamePhase?: GameLiveState['phase'];
  beautyEffectId?: BeautyPresetId;
  beautyEffects?: TencentEffectSelection;
  beautyBodyShape?: BodyShapeParams;
  beautyPanelOpen?: boolean;
  onToggleBeautyPanel?: () => void;
  onSelectBeauty?: (beautyId: BeautyPresetId) => void;
  onBeautyEffectsChange?: (effects: TencentEffectSelection) => void;
  onBeautyBodyShapeChange?: (shape: BodyShapeParams) => void;
};

function renderChatMessages(
  liveChatMsgs: LiveChatMsg[],
  handlers: {
    renderAnnouncementWelcome: GameLiveViewProps['renderAnnouncementWelcome'];
    renderSingChatEvent: GameLiveViewProps['renderSingChatEvent'];
    renderJoinChatEvent: GameLiveViewProps['renderJoinChatEvent'];
    renderGiftChatEvent: GameLiveViewProps['renderGiftChatEvent'];
    renderStandardChatMessage: GameLiveViewProps['renderStandardChatMessage'];
  },
) {
  return liveChatMsgs.map((msg, idx) => {
    const messageId = msg.id ?? idx;
    const wrap = (node: React.ReactNode) => (
      <div key={messageId} className="flex w-full justify-start text-left">
        {node}
      </div>
    );
    if (msg.isAnnouncementWelcome) {
      return wrap(handlers.renderAnnouncementWelcome({ ...msg, id: messageId }));
    }
    if (msg.isSystem) {
      return wrap(
        <div className="mx-0 w-fit max-w-full rounded-full border border-emerald-500/20 bg-emerald-950/30 px-3 py-1 text-center text-[10px] font-bold text-emerald-200/90">
          {msg.text}
        </div>,
      );
    }
    if (msg.isSingEvent) return wrap(handlers.renderSingChatEvent({ ...msg, id: messageId }));
    if (msg.isJoinEvent) return wrap(handlers.renderJoinChatEvent({ ...msg, id: messageId }));
    if (msg.isGiftEvent) return wrap(handlers.renderGiftChatEvent({ ...msg, id: messageId }));
                return wrap(
                  handlers.renderStandardChatMessage(
                    { ...msg, id: messageId },
                    {
                      layout: 'inline',
                      bubbleClassName: 'bg-black/35 backdrop-blur-xl border border-white/5 shadow-sm',
                    },
                  ),
                );
  });
}

export function GameLiveView({
  roomDisplayId,
  roomTitle,
  announcement,
  isRoomSaved,
  roomIdCopied,
  onCopyRoomId,
  onToggleSaveRoom,
  hostUserId,
  isSelfHost,
  onLeaveRoom,
  onShareRoom,
  onOpenRoomDetails,
  onOpenRoomEdit,
  activeSeats,
  handleSeatClick,
  buildViewerFromGuest,
  handleSelectViewer,
  ownerSocial,
  viewers,
  roomExpProgress,
  roomGiftSummary,
  setIsRoomBackgroundMenuOpen,
  setIsRoomViewersOpen,
  onSelectViewer,
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
  canChangeRoomBackground,
  backgroundMode,
  pendingBackgroundMode,
  onOpenArenaRankings,
  showToast,
  canEditAnnouncement = false,
  onEditAnnouncement,
  canChangeRoomMode = false,
  onOpenRoomModePicker,
  onOpenSing,
  hasActiveSong = false,
  songQueueLength = 0,
  hideSingMenu = false,
  processedAudioTrack = null,
  voiceMicPublishing = false,
  showVoiceChanger = false,
  voiceChangerEligible = false,
  voiceChangerOpen = false,
  voiceEffectActive = false,
  voiceEffectEmoji,
  onToggleVoiceChanger,
  onOpenGiftSenders,
  onOpenGame,
  gamePhase = 'idle',
  beautyEffectId = 'none',
  beautyEffects = {
    makeupId: null,
    stickerId: null,
    filterId: null,
    backgroundUrl: null,
  },
  beautyBodyShape,
  beautyPanelOpen = false,
  onToggleBeautyPanel,
  onSelectBeauty,
  onBeautyEffectsChange,
  onBeautyBodyShapeChange,
}: GameLiveViewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const storedLayout = useMemo(() => readStoredLayout(roomDisplayId), [roomDisplayId]);
  const [chatOpen, setChatOpen] = useState(true);
  const [viewersOpen, setViewersOpen] = useState(true);
  const [pipPosition, setPipPosition] = useState<CommerceCardPosition>(
    storedLayout.pip ?? DEFAULT_PIP_POSITION,
  );
  const [chatPosition, setChatPosition] = useState<CommerceCardPosition>(
    storedLayout.chat ?? DEFAULT_CHAT_POSITION,
  );
  const [viewersPosition, setViewersPosition] = useState<CommerceCardPosition>(
    storedLayout.viewers ?? DEFAULT_VIEWERS_POSITION,
  );
  const [toolsDockPosition, setToolsDockPosition] = useState<CommerceCardPosition>(() =>
    clampGameLiveEdgePosition(storedLayout.toolsDock ?? DEFAULT_TOOLS_DOCK_POSITION),
  );

  const persistLayout = useCallback(
    (next: Partial<GameLiveLayout>) => {
      if (!isSelfHost) return;
      writeStoredLayout(roomDisplayId, {
        pip: next.pip ?? pipPosition,
        chat: next.chat ?? chatPosition,
        viewers: next.viewers ?? viewersPosition,
        toolsDock: next.toolsDock ?? toolsDockPosition,
      });
    },
    [chatPosition, isSelfHost, pipPosition, roomDisplayId, toolsDockPosition, viewersPosition],
  );

  const handlePipPosition = useCallback(
    (position: CommerceCardPosition) => {
      setPipPosition(position);
      persistLayout({ pip: position });
    },
    [persistLayout],
  );

  const handleChatPosition = useCallback(
    (position: CommerceCardPosition) => {
      setChatPosition(position);
      persistLayout({ chat: position });
    },
    [persistLayout],
  );

  const handleViewersPosition = useCallback(
    (position: CommerceCardPosition) => {
      setViewersPosition(position);
      persistLayout({ viewers: position });
    },
    [persistLayout],
  );

  const handleToolsDockPosition = useCallback(
    (position: CommerceCardPosition) => {
      setToolsDockPosition(position);
      persistLayout({ toolsDock: position });
    },
    [persistLayout],
  );

  const pipDrag = usePercentOverlayDrag({
    position: pipPosition,
    onPositionChange: handlePipPosition,
    enabled: isSelfHost,
    edgeToEdge: true,
  });
  const chatDrag = usePercentOverlayDrag({
    position: chatPosition,
    onPositionChange: handleChatPosition,
    enabled: isSelfHost,
    edgeToEdge: true,
  });
  const viewersDrag = usePercentOverlayDrag({
    position: viewersPosition,
    onPositionChange: handleViewersPosition,
    enabled: isSelfHost,
    edgeToEdge: true,
  });
  const toolsDockDrag = usePercentOverlayDrag({
    position: toolsDockPosition,
    onPositionChange: handleToolsDockPosition,
    enabled: isSelfHost,
    edgeToEdge: true,
  });
  // Keep aliases so a half-applied HMR patch that still references the old
  // per-FAB drag handles cannot throw ReferenceError mid-session.
  const menuDrag = toolsDockDrag;
  const chatToggleDrag = toolsDockDrag;
  const viewersToggleDrag = toolsDockDrag;
  void menuDrag;
  void chatToggleDrag;
  void viewersToggleDrag;

  const startOverlayDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, drag: ReturnType<typeof usePercentOverlayDrag>) => {
      event.preventDefault();
      event.stopPropagation();
      drag.handlePointerDown(event, stageRef.current);
    },
    [],
  );

  const showBeautyControls = Boolean(onToggleBeautyPanel && onSelectBeauty && isTencentWebARConfigured());
  const beautyActive =
    beautyEffectId !== 'none' ||
    Boolean(
      beautyEffects.makeupId ||
        beautyEffects.stickerId ||
        beautyEffects.filterId ||
        beautyEffects.backgroundUrl,
    );

  const hostCameraEffects = useMultiGuestCameraEffects({
    enabled: isSelfHost,
    beautyId: beautyEffectId,
    beautyEffects,
    bodyShape: beautyBodyShape,
    beautyPanelOpen,
  });

  const {
    videoTrack: hostCameraTrack,
    beautyVideoRef,
    showBeautyPreview,
    beautyCatalogs,
    beautyConfigured,
    beautyLoading,
    beautyError,
  } = hostCameraEffects;

  const {
    casting,
    startingCast,
    cameraOn,
    castError,
    screenVideoRef,
    cameraVideoRef,
    remoteScreenVideoRef,
    remoteCameraVideoRef,
    hasRemoteCast,
    hasRemoteCamera,
    startCast,
    toggleCamera,
  } = useGameLiveKit({
    roomId: roomDisplayId,
    hostUserId,
    isHost: isSelfHost,
    enabled: true,
    publishMic: voiceMicPublishing,
    processedAudioTrack,
    hostCameraTrack: isSelfHost ? hostCameraTrack : null,
  });

  useEffect(() => {
    if (castError) showToast(castError);
  }, [castError, showToast]);

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
        id: 'mode',
        label: 'Change room mode',
        icon: <LayoutGrid size={15} aria-hidden />,
        onClick: () => onOpenRoomModePicker?.(),
        hidden: !canChangeRoomMode || !onOpenRoomModePicker,
      },
      ...(onOpenSing
        ? [
            createSingHeaderMenuItem(onOpenSing, {
              hasActiveSong,
              hidden: hideSingMenu,
              queueLength: songQueueLength,
            }),
          ]
        : []),
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
      createRoomBackgroundHeaderMenuItem(() => setIsRoomBackgroundMenuOpen(true), {
        hidden: !canChangeRoomBackground,
      }),
      createYoutubeMiniHeaderMenuItem(),
      {
        id: 'leave',
        label: 'Leave room',
        icon: <LogOut size={15} aria-hidden />,
        onClick: onLeaveRoom,
        hidden: !isSelfHost,
      },
    ],
    [
      onOpenRoomDetails,
      onOpenRoomEdit,
      onOpenRoomModePicker,
      canChangeRoomMode,
      hasActiveSong,
      hideSingMenu,
      onOpenSing,
      onShareRoom,
      canEditAnnouncement,
      onEditAnnouncement,
      canChangeRoomBackground,
      setIsRoomBackgroundMenuOpen,
      songQueueLength,
      onLeaveRoom,
      isSelfHost,
    ],
  );

  const showHostScreen = isSelfHost && casting;
  const showViewerScreen = !isSelfHost && hasRemoteCast;
  const showHostPip = isSelfHost && casting && cameraOn;
  const showViewerPip = !isSelfHost && hasRemoteCamera;

  const chatHandlers = {
    renderAnnouncementWelcome,
    renderSingChatEvent,
    renderJoinChatEvent,
    renderGiftChatEvent,
    renderStandardChatMessage,
  };

  const chatFooter = (
    <div className={`game-live-footer ${isSelfHost ? 'game-live-footer--host' : ''}`}>
      <form onSubmit={handleSendMessage} className="relative min-w-0 flex-1">
        {mentionSearch !== null ? (
          <div className="absolute bottom-full left-0 z-[100] mb-2 w-44 overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#0d1a14]/95 shadow-lg backdrop-blur-xl">
            <div className="max-h-40 overflow-y-auto py-1 scrollbar-hide">
              {getMentionSuggestions().length > 0 ? (
                getMentionSuggestions().map((user, index) => (
                  <button
                    key={`${user.name}-${index}`}
                    type="button"
                    onClick={() => selectMention(user.name)}
                    className="flex w-full items-center space-x-2 px-3 py-2 text-left hover:bg-white/10"
                  >
                    <img src={safeAvatarUrl(user.avatar)} className="h-6 w-6 rounded-full object-cover" alt="" />
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
          placeholder="Say hi..."
          className="party-glass-input w-full min-w-0 rounded-full py-2 pl-3.5 pr-9 text-[12px] font-bold text-white placeholder:text-white/30"
        />
        {chatInput.trim() ? (
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400"
            aria-label="Send message"
          >
            <Send size={14} />
          </button>
        ) : null}
      </form>

      <div className="game-live-footer-actions">
        <RoomFooterTrayActions
          userSeatKey={isSelfHost ? userSeatKey ?? 'host' : userSeatKey}
          userMicOn={userMicOn}
          userVoiceActive={userVoiceActive}
          onToggleUserMic={onToggleUserMic}
          onToggleSeatParticipation={onToggleSeatParticipation}
          onOpenGuestManagement={() => setIsGuestManagementOpen(true)}
          guestManagementOpen={guestManagementOpen}
          onOpenGiftPicker={() => setIsGiftPickerOpen(true)}
          showCamera={isSelfHost}
          userCameraOn={cameraOn}
          onToggleUserCamera={() => {
            void toggleCamera();
          }}
          showBeauty={showBeautyControls}
          beautyPanelOpen={beautyPanelOpen}
          beautyActive={beautyActive}
          onToggleBeautyPanel={onToggleBeautyPanel}
          showSeatToggle={!isSelfHost}
          showGuestManagement={!isSelfHost}
          showGift={!isSelfHost}
          micAccent="cyan"
          className="game-live-footer-tray"
          showVoiceChanger={showVoiceChanger}
          voiceChangerEligible={voiceChangerEligible}
          voiceChangerOpen={voiceChangerOpen}
          voiceEffectActive={voiceEffectActive}
          voiceEffectEmoji={voiceEffectEmoji}
          onToggleVoiceChanger={onToggleVoiceChanger}
        />

        {!isSelfHost ? (
          <RoomArenaOpenButton
            onOpen={onOpenArenaRankings}
            className="!h-8 !w-8 sm:!h-9 sm:!w-9"
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="game-live-layout relative flex h-full min-h-0 flex-1 flex-col w-full overflow-hidden font-sans">
      <RoomBackgroundLayer mode={pendingBackgroundMode ?? backgroundMode} />
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {!isSelfHost ? (
          <header className="game-live-header absolute inset-x-0 top-0 z-40 flex shrink-0 flex-col gap-1 bg-gradient-to-b from-black/90 via-black/55 to-transparent px-3 pb-2 pt-2 sm:px-4 sm:pt-3">
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
                  className="party-viewers-chip party-glass-chip flex min-h-[32px] cursor-pointer items-center space-x-2 rounded-full px-2.5 py-1.5 sm:px-3 transition"
                >
                  <div className="-space-x-2 mr-0.5 flex">
                    {viewers.slice(0, 3).map((viewer) => (
                      <img
                        key={viewer.id}
                        src={safeAvatarUrl(viewer.avatar)}
                        className="h-6 w-6 rounded-full border-2 border-[#07010a] object-cover sm:h-7 sm:w-7"
                        alt=""
                      />
                    ))}
                  </div>
                  <Users size={16} className="text-gray-300" />
                  <span className="party-viewers-count font-black text-gray-100">{viewers.length}</span>
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
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
              {!isSelfHost && activeSeats?.host && handleSeatClick && ownerSocial ? (
                <RoomOwnerSocialControls
                  name={activeSeats.host.name}
                  avatarUrl={activeSeats.host.avatar}
                  starCount={activeSeats.host.stars}
                  isSpeaking={Boolean(activeSeats.host.isSpeaking)}
                  isFollowing={ownerSocial.isFollowingOwner}
                  onToggleFollow={ownerSocial.toggleFollowOwner}
                  showFollowButton={!ownerSocial.isSelfOwner}
                  onProfileClick={() => handleSeatClick('host')}
                  className="shrink-0"
                />
              ) : null}
              <button
                type="button"
                onClick={onOpenRoomDetails}
                className="flex shrink-0 items-center rounded-full px-2 py-0.5 text-[8.5px] font-bold text-emerald-400 backdrop-blur transition hover:bg-emerald-950/20 active:scale-95"
              >
                <span>
                  EXP {roomExpProgress.todayExp}/{roomExpProgress.dailyCap}
                </span>
                <ChevronRight size={8} className="ml-0.5 text-emerald-500" />
              </button>
              <button
                type="button"
                onClick={() => setIsGiftPickerOpen(true)}
                className="flex shrink-0 items-center rounded-full border border-pink-500/20 bg-[#240c1e]/80 px-2 py-0.5 text-[8.5px] font-bold text-pink-400 backdrop-blur transition hover:bg-pink-950/20 active:scale-95"
              >
                <CoinIcon className="mr-0.5 h-2 w-2 shrink-0" />
                <span>{roomGiftSummary.totalStars.toLocaleString()}</span>
              </button>
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-950/40 px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wide text-emerald-200">
                <Gamepad2 size={10} />
                Game Live
              </span>
            </div>
          </header>
        ) : null}

        <div ref={stageRef} className="game-live-stage relative min-h-0 flex-1">
          {showHostScreen ? (
            <video ref={screenVideoRef} autoPlay playsInline muted className="game-live-screen-video" />
          ) : showViewerScreen ? (
            <video ref={remoteScreenVideoRef} autoPlay playsInline className="game-live-screen-video" />
          ) : (
            <div className="game-live-screen-placeholder flex h-full w-full flex-col items-center justify-center gap-4 bg-black text-center">
              {isSelfHost ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                    <Monitor size={30} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-white">Share your screen</p>
                    <p className="text-[11px] font-medium text-white/55">
                      Pick a window or screen in the browser share dialog. Camera PiP is optional.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void startCast()}
                    disabled={startingCast}
                    className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-500/30 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                  >
                    {startingCast ? 'Opening share…' : 'Share screen'}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50">
                    <Gamepad2 size={30} />
                  </div>
                  <p className="text-sm font-black text-white/90">Waiting for host to start the game</p>
                  <p className="text-[11px] font-medium text-white/45">The stream will appear here automatically.</p>
                </>
              )}
            </div>
          )}

          {showHostPip ? (
            <div
              className={`game-live-draggable pointer-events-auto absolute ${pipDrag.dragging ? 'cursor-grabbing' : ''}`}
              style={percentOverlayStyle(pipDrag.displayPosition, 28)}
            >
              <div className="game-live-pip game-live-pip--host">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Drag camera view"
                  onPointerDown={(event) => startOverlayDrag(event, pipDrag)}
                  className="game-live-pip-drag-handle"
                >
                  <GripVertical size={10} aria-hidden />
                </div>
                <video
                  ref={showBeautyPreview ? beautyVideoRef : cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <span className="game-live-pip-label">YOU</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleCamera();
                  }}
                  className="game-live-pip-camera-btn"
                  aria-label="Turn camera off"
                  title="Turn camera off"
                >
                  <VideoOff size={12} />
                </button>
              </div>
            </div>
          ) : null}

          {showViewerPip ? (
            <div className="game-live-pip game-live-pip--viewer">
              <video ref={remoteCameraVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
              <span className="game-live-pip-label">HOST</span>
            </div>
          ) : null}

          {isSelfHost && viewersOpen ? (
            <div
              className={`game-live-draggable pointer-events-auto absolute w-[min(88vw,16rem)] ${viewersDrag.dragging ? 'cursor-grabbing' : ''}`}
              style={percentOverlayStyle(viewersDrag.displayPosition, 34)}
            >
              <div className="game-live-floating-viewers">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Drag viewer list"
                  onPointerDown={(event) => startOverlayDrag(event, viewersDrag)}
                  className="game-live-floating-viewers-handle"
                >
                  <GripVertical size={12} className="text-white/45" aria-hidden />
                  <Eye size={12} className="text-emerald-300/80" aria-hidden />
                  <span className="text-[9px] font-black uppercase tracking-wide text-white/55">
                    Viewers ({viewers.length})
                  </span>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setViewersOpen(false);
                    }}
                    className="ml-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                    aria-label="Hide viewer list"
                    title="Hide viewers"
                  >
                    <EyeOff size={13} />
                  </button>
                </div>
                <div className="game-live-viewers-scroll scrollbar-hide">
                  {viewers.length > 0 ? (
                    viewers.map((viewer) => (
                      <button
                        key={viewer.id}
                        type="button"
                        onClick={() => onSelectViewer?.(viewer)}
                        className="game-live-viewer-row"
                      >
                        <img
                          src={safeAvatarUrl(viewer.avatar)}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover"
                        />
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate text-[11px] font-bold text-white/90">{viewer.name}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {viewer.isOwner ? (
                              <span className="inline-flex items-center gap-0.5 rounded bg-purple-500/20 px-1 py-0.5 text-[7px] font-black uppercase text-purple-200">
                                <Crown size={7} /> Owner
                              </span>
                            ) : null}
                            {viewer.isCoOwner ? (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1 py-0.5 text-[7px] font-black uppercase text-amber-200">
                                <Crown size={7} /> Co
                              </span>
                            ) : null}
                            {viewer.isAdmin ? (
                              <span className="inline-flex items-center gap-0.5 rounded bg-yellow-500/20 px-1 py-0.5 text-[7px] font-black uppercase text-yellow-200">
                                <Shield size={7} /> Admin
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-center text-[10px] font-medium text-white/40">No viewers yet</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {isSelfHost && chatOpen ? (
            <div
              className={`game-live-draggable pointer-events-auto absolute w-[min(92vw,22rem)] ${chatDrag.dragging ? 'cursor-grabbing' : ''}`}
              style={percentOverlayStyle(chatDrag.displayPosition, 36)}
            >
              <div className="game-live-floating-chat">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Drag live chat"
                  onPointerDown={(event) => startOverlayDrag(event, chatDrag)}
                  className="game-live-floating-chat-handle"
                >
                  <GripVertical size={12} className="text-white/45" aria-hidden />
                  <span className="text-[9px] font-black uppercase tracking-wide text-white/55">Live chat</span>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setChatOpen(false);
                    }}
                    className="ml-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                    aria-label="Hide live chat"
                    title="Hide chat"
                  >
                    <MessageCircleOff size={13} />
                  </button>
                </div>
                <div ref={chatScrollRef} onScroll={handleChatScroll} className="game-live-chat-scroll scrollbar-hide">
                  <div className="game-live-chat-feed">{renderChatMessages(liveChatMsgs, chatHandlers)}</div>
                </div>
                {chatFooter}
              </div>
            </div>
          ) : null}

          {!isSelfHost && chatOpen ? (
            <div className="game-live-chat-overlay game-live-chat-overlay--viewer">
              <div className="game-live-chat-panel">
                <div ref={chatScrollRef} onScroll={handleChatScroll} className="game-live-chat-scroll scrollbar-hide">
                  <div className="game-live-chat-feed">{renderChatMessages(liveChatMsgs, chatHandlers)}</div>
                </div>
                {chatFooter}
              </div>
            </div>
          ) : null}

          {isSelfHost ? (
            <div
              className={`game-live-draggable pointer-events-auto absolute ${toolsDockDrag.dragging ? 'cursor-grabbing' : ''}`}
              style={percentOverlayStyle(toolsDockDrag.displayPosition, 42)}
            >
              <div className="game-live-tools-dock">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Drag tools"
                  onPointerDown={(event) => startOverlayDrag(event, toolsDockDrag)}
                  className="game-live-tools-dock-handle"
                >
                  <GripVertical size={14} className="text-white/55" aria-hidden />
                </div>
                <div className="game-live-tools-dock-actions">
                  {!viewersOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (toolsDockDrag.consumeClickIfDragged()) return;
                        setViewersOpen(true);
                      }}
                      className="game-live-tools-dock-btn game-live-tools-dock-btn--viewers"
                      aria-label="Show viewer list"
                      title="Show viewers"
                    >
                      <Users size={16} />
                      <span className="game-live-viewers-toggle-count">{viewers.length}</span>
                    </button>
                  ) : null}
                  {!chatOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (toolsDockDrag.consumeClickIfDragged()) return;
                        setChatOpen(true);
                      }}
                      className="game-live-tools-dock-btn"
                      aria-label="Show live chat"
                      title="Show chat"
                    >
                      <MessageCircle size={16} />
                    </button>
                  ) : null}
                  {onOpenGame ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (toolsDockDrag.consumeClickIfDragged()) return;
                        onOpenGame();
                      }}
                      className={`game-live-tools-dock-btn ${gamePhase === 'active' ? 'text-violet-300' : ''}`}
                      aria-label="Open live game"
                      title="Live trivia"
                    >
                      <Gamepad2 size={16} />
                    </button>
                  ) : null}
                  <RoomHeaderActionsMenu items={headerMenuItems} className="game-live-tools-dock-menu" />
                </div>
              </div>
            </div>
          ) : null}

          {!isSelfHost ? (
            <button
              type="button"
              onClick={() => onOpenGame?.()}
              className={`absolute right-3 top-[calc(3.25rem+var(--app-safe-top))] z-40 flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/30 bg-black/55 text-violet-200 backdrop-blur-md ${gamePhase === 'active' ? 'ring-1 ring-violet-400/60' : ''}`}
              aria-label="Open live game"
              title="Live trivia"
            >
              <Gamepad2 size={16} />
            </button>
          ) : null}

          {!isSelfHost ? (
            <button
              type="button"
              onClick={() => setChatOpen((open) => !open)}
              className={`game-live-chat-toggle game-live-chat-toggle--viewer ${chatOpen ? 'game-live-chat-toggle--open' : ''}`}
              aria-label={chatOpen ? 'Hide live chat' : 'Show live chat'}
              title={chatOpen ? 'Hide chat' : 'Show chat'}
            >
              {chatOpen ? <MessageCircleOff size={18} /> : <MessageCircle size={18} />}
            </button>
          ) : null}
        </div>
      </div>

      {showBeautyControls && onSelectBeauty && onToggleBeautyPanel ? (
        <LiveBeautySheet
          isOpen={beautyPanelOpen}
          onClose={onToggleBeautyPanel}
          activeBeautyId={beautyEffectId}
          onSelectBeauty={onSelectBeauty}
          effects={beautyEffects}
          onEffectsChange={onBeautyEffectsChange}
          bodyShape={beautyBodyShape}
          onBodyShapeChange={onBeautyBodyShapeChange}
          catalogs={beautyCatalogs}
          anchorBottom={beautyPanelOpen ? 8 : 96}
          anchorMode="container"
          webarConfigured={beautyConfigured}
          webarLoading={beautyLoading}
          webarError={beautyError}
        />
      ) : null}
    </div>
  );
}

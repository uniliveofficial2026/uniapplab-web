import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Gift,
  Info,
  LayoutGrid,
  Lock,
  LogOut,
  Mic,
  MicOff,
  Send,
  Settings2,
  Sofa,
  Video,
  VideoOff,
  Users,
} from 'lucide-react';
import { RoomArenaColumn } from './RoomArenaLeaderboard';
import type { ArenaLeaderboardParticipant } from './RoomArenaLeaderboard';
import { RoomBackgroundLayer } from './RoomBackgroundLayer';
import { RoomFooterTrayActions } from './RoomFooterTrayActions';
import type { CameraFacingMode } from '../../lib/camera/useCameraStream';
import { RoomHeaderActionsMenu, createRoomBackgroundHeaderMenuItem, createSingHeaderMenuItem, createYoutubeMiniHeaderMenuItem, type RoomHeaderMenuItem } from './RoomHeaderActionsMenu';
import { RoomHeaderYoutubeMiniButton } from './RoomHeaderYoutubeMiniButton';
import { RoomLiveHeaderInfo } from './RoomLiveHeaderInfo';
import { RoomOwnerSocialControls } from './RoomOwnerSocialControls';
import { CoinIcon } from '../../components/common/CoinIcon';
import { MultiGuestSeatMedia } from './MultiGuestSeatMedia';
import { MultiGuestSelfMediaHost } from './MultiGuestSelfMediaHost';
import { MultiGuestEffectsSheet } from './MultiGuestEffectsSheet';
import { LiveBeautySheet } from './LiveBeautySheet';
import { SeatSpeakingLevelBars } from './SeatVoiceVisuals';
import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import { deeparSelectionActive, type DeepAREffectSelection } from '../../lib/deepar/deeparEffectSelection';
import type {
  TencentBodyShapeParams,
  TencentEffectItem,
  TencentEffectSelection,
} from '../../lib/webar/webarTypes';
import { EMPTY_BODY_SHAPE, EMPTY_TENCENT_EFFECT_SELECTION } from '../../lib/webar/webarTypes';
import {
  resolveSeatVideoUserId,
  type MultiGuestLiveKitState,
} from '../hooks/useMultiGuestLiveKit';
import type { RoomBackgroundMode } from '../utils/roomBackground';
import type { RoomExpProgress } from '../utils/roomExp';
import type { RoomGiftSummary } from '../utils/roomGifts';
import type { PartySeatMap, RoomGuest, RoomSeatKey } from '../utils/roomSeats';
import {
  getMultiGuestVideoGridClass,
  getMultiGuestVideoLayout,
  resolveMergedHostTileSeats,
  type MultiGuestSeatCount,
  type MultiGuestVideoLayoutItem,
  formatMultiGuestSeatLabel,
  formatStaffSeatLabel,
  resolveSeatGuestDisplay,
} from '../utils/roomSeats';
import type { RoomViewerEntry } from '../utils/roomViewers';
import { safeAvatarUrl } from '../../lib/safe';

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
  isAnnouncementWelcome?: boolean;
  targetViewerId?: string;
  targetViewerName?: string;
  targetViewerAvatar?: string;
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

type MultiGuestViewProps = {
  roomDisplayId: string;
  roomTitle: string;
  announcement: string;
  isRoomSaved: boolean;
  roomIdCopied: boolean;
  onCopyRoomId: (event: React.MouseEvent) => void;
  onToggleSaveRoom: (event: React.MouseEvent) => void;
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
  onOpenGiftSenders: (receiver: { name: string; userId?: string }) => void;
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
  userCameraOn: boolean;
  onToggleUserCamera: () => void;
  userSeatKey: string | null;
  userMicOn: boolean;
  userVoiceActive: boolean;
  userMicLevel: number;
  audioPulse: number;
  arenaParticipants: ArenaLeaderboardParticipant[];
  arenaCountdownText: string;
  onOpenArenaRankings: () => void;
  lockedSeats: Record<string, boolean>;
  canChangeRoomBackground: boolean;
  backgroundMode: RoomBackgroundMode;
  canEditAnnouncement?: boolean;
  onEditAnnouncement?: () => void;
  canChangeRoomMode?: boolean;
  onOpenRoomModePicker?: () => void;
  ownerSocial: {
    ownerIdentity: { name: string; avatarUrl: string };
    starCount: number;
    isFollowingOwner: boolean;
    toggleFollowOwner: () => void;
    isSelfOwner: boolean;
    ownerViewerPayload: ChatViewerPayload;
  };
  multiGuestLiveKit: MultiGuestLiveKitState;
  rawVideoRef?: React.RefObject<HTMLVideoElement | null>;
  deeparPreviewRef?: React.RefObject<HTMLDivElement | null>;
  beautyVideoRef?: React.RefObject<HTMLVideoElement | null>;
  showDeeparPreview?: boolean;
  showBeautyPreview?: boolean;
  beautyCssFilter?: string | null;
  beautyConfigured?: boolean;
  beautyLoading?: boolean;
  beautyError?: string | null;
  multiGuestSeatCount?: MultiGuestSeatCount;
  effectsConfigured?: boolean;
  effectsPanelOpen?: boolean;
  onToggleEffectsPanel?: () => void;
  activeEffectId?: string;
  onSelectEffect?: (effectId: string) => void;
  activeDeeparSelection?: DeepAREffectSelection;
  onDeeparSelectionChange?: (selection: DeepAREffectSelection) => void;
  effectsLoading?: boolean;
  effectsCameraReady?: boolean;
  effectsArReady?: boolean;
  cameraFacingMode?: CameraFacingMode;
  onToggleCameraFacing?: () => void;
  beautyEffectId?: BeautyPresetId;
  beautyEffects?: TencentEffectSelection;
  beautyCatalogs?: {
    makeups: TencentEffectItem[];
    stickers: TencentEffectItem[];
    filters: TencentEffectItem[];
    backgrounds: string[];
  };
  beautyPanelOpen?: boolean;
  onToggleBeautyPanel?: () => void;
  onSelectBeauty?: (beautyId: BeautyPresetId) => void;
  onBeautyEffectsChange?: (effects: TencentEffectSelection) => void;
  beautyBodyShape?: TencentBodyShapeParams;
  onBeautyBodyShapeChange?: (shape: TencentBodyShapeParams) => void;
  onOpenSing?: () => void;
  hasActiveSong?: boolean;
  songQueueLength?: number;
  hideSingMenu?: boolean;
  onPkClick?: () => void;
  onGameClick?: () => void;
};


function truncateName(name: string, max = 10): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export const MultiGuestView: React.FC<MultiGuestViewProps> = ({
  roomDisplayId,
  roomTitle,
  announcement,
  isRoomSaved,
  roomIdCopied,
  onCopyRoomId,
  onToggleSaveRoom,
  onLeaveRoom,
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
  onOpenGiftSenders,
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
  renderJoinChatEvent,
  renderSingChatEvent,
  renderGiftChatEvent,
  renderAnnouncementWelcome,
  renderStandardChatMessage,
  mentionSearch,
  onToggleUserMic,
  onToggleSeatParticipation,
  guestManagementOpen = false,
  userCameraOn,
  onToggleUserCamera,
  userSeatKey,
  userMicOn,
  userVoiceActive,
  userMicLevel,
  audioPulse,
  arenaParticipants,
  arenaCountdownText,
  onOpenArenaRankings,
  lockedSeats,
  canChangeRoomBackground,
  backgroundMode,
  canEditAnnouncement = false,
  onEditAnnouncement,
  canChangeRoomMode = false,
  onOpenRoomModePicker,
  ownerSocial,
  multiGuestLiveKit,
  rawVideoRef,
  deeparPreviewRef,
  beautyVideoRef,
  showDeeparPreview = false,
  showBeautyPreview = false,
  beautyCssFilter = null,
  beautyConfigured = false,
  beautyLoading = false,
  beautyError = null,
  multiGuestSeatCount = 15,
  effectsConfigured = false,
  effectsPanelOpen = false,
  onToggleEffectsPanel,
  activeEffectId = 'none',
  onSelectEffect,
  activeDeeparSelection,
  onDeeparSelectionChange,
  effectsLoading = false,
  effectsCameraReady = false,
  effectsArReady = false,
  cameraFacingMode = 'user',
  onToggleCameraFacing,
  beautyEffectId = 'none',
  beautyEffects = EMPTY_TENCENT_EFFECT_SELECTION,
  beautyCatalogs,
  beautyPanelOpen = false,
  onToggleBeautyPanel,
  onSelectBeauty,
  onBeautyEffectsChange,
  beautyBodyShape = EMPTY_BODY_SHAPE,
  onBeautyBodyShapeChange,
  onOpenSing,
  hasActiveSong = false,
  songQueueLength = 0,
  hideSingMenu = false,
  onPkClick,
  onGameClick,
}) => {
  const deeparEffectActive = effectsConfigured && (
    activeDeeparSelection
      ? deeparSelectionActive(activeDeeparSelection)
      : activeEffectId !== 'none'
  );
  const selfUsesCssMirror =
    cameraFacingMode === 'user' &&
    !(effectsConfigured && deeparEffectActive && effectsArReady);
  const showDeepARControls = Boolean(
    effectsConfigured &&
      onToggleEffectsPanel &&
      (onDeeparSelectionChange || onSelectEffect),
  );
  const showBeautyControls = Boolean(onToggleBeautyPanel && onSelectBeauty);
  const beautyActive =
    beautyEffectId !== 'none' ||
    Boolean(
      beautyEffects.makeupId ||
        beautyEffects.stickerId ||
        beautyEffects.filterId ||
        beautyEffects.backgroundUrl,
    );
  const footerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const selfTileAnchorRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer) return undefined;

    const syncFooterHeight = () => {
      setFooterHeight(footer.offsetHeight);
    };

    syncFooterHeight();
    const observer = new ResizeObserver(syncFooterHeight);
    observer.observe(footer);
    window.addEventListener('resize', syncFooterHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncFooterHeight);
    };
  }, []);

  const videoLayout = useMemo(
    () => getMultiGuestVideoLayout(multiGuestSeatCount),
    [multiGuestSeatCount],
  );
  const videoGridClass = getMultiGuestVideoGridClass(multiGuestSeatCount);

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
      createRoomBackgroundHeaderMenuItem(() => setIsRoomBackgroundMenuOpen(true), {
        hidden: !canChangeRoomBackground,
      }),
      createYoutubeMiniHeaderMenuItem(),
    ],
    [
      canChangeRoomBackground,
      canChangeRoomMode,
      hasActiveSong,
      hideSingMenu,
      onOpenRoomDetails,
      onOpenRoomEdit,
      onOpenRoomModePicker,
      onOpenSing,
      setIsRoomBackgroundMenuOpen,
      songQueueLength,
    ],
  );

  const renderTile = (layoutItem: MultiGuestVideoLayoutItem, slotIndex: number) => {
    const { seatKey: key, colSpan = 1, rowSpan = 1, gridColumn, gridRow, foldedSeatKeys } = layoutItem;
    const tileSeatKeys: RoomSeatKey[] = foldedSeatKeys ? [key, ...foldedSeatKeys] : [key];
    const merged = foldedSeatKeys ? resolveMergedHostTileSeats(foldedSeatKeys, activeSeats) : null;
    const displayKey = merged?.primaryKey ?? key;
    const rawGuest = merged?.primaryGuest ?? activeSeats[key];
    const guest = rawGuest ? resolveSeatGuestDisplay(rawGuest, roomDisplayId) : null;
    const isLocked =
      tileSeatKeys.some((seatKey) => Boolean(lockedSeats[seatKey])) && !guest;
    const isSelfTile = Boolean(userSeatKey && tileSeatKeys.includes(userSeatKey as RoomSeatKey));
    const interactionKey = isSelfTile ? (userSeatKey as RoomSeatKey) : displayKey;
    const isStaffSeat = displayKey === 'host' || displayKey === 'coowner' || displayKey === 'admin';
    const label = formatMultiGuestSeatLabel(key, multiGuestSeatCount, { uppercase: true });
    const guestUserId = guest ? resolveSeatVideoUserId(guest, roomDisplayId) : null;
    const micUnmuted = Boolean(guest?.isSpeaking);
    const voiceVisualActive = guest
      ? micUnmuted &&
        (isSelfTile
          ? userVoiceActive
          : guestUserId && multiGuestLiveKit.configured
            ? multiGuestLiveKit.activeSpeakerUserIds.has(guestUserId)
            : micUnmuted)
      : false;
    const voicePulse = isSelfTile && userMicOn ? userMicLevel : audioPulse;
    const hasLiveVideo = isSelfTile
      ? userCameraOn
      : Boolean(guestUserId && multiGuestLiveKit.remoteVideoByUserId.has(guestUserId));
    const isHostExpanded = key === 'host' && (colSpan >= 2 || gridColumn === '1 / 4');
    const tileClassName = [
      'multi-guest-video-tile group text-left',
      !gridColumn && colSpan === 2 ? 'multi-guest-video-tile--col-span-2' : '',
      !gridRow && rowSpan === 2 ? 'multi-guest-video-tile--row-span-2' : '',
      isHostExpanded ? 'multi-guest-video-tile--host-expanded' : '',
      isHostExpanded && gridColumn === '1 / 4' ? 'multi-guest-video-tile--host-mega' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const tilePlacementStyle: React.CSSProperties | undefined =
      gridColumn || gridRow
        ? {
            ...(gridColumn ? { gridColumn } : {}),
            ...(gridRow ? { gridRow } : {}),
          }
        : undefined;

    return (
      <button
        key={foldedSeatKeys ? `${key}-mega` : key}
        type="button"
        onClick={() => handleSeatClick(displayKey)}
        className={tileClassName}
        style={tilePlacementStyle}
        aria-label={guest ? `${guest.name} video tile` : `Join ${label}`}
      >
        {guest ? (
          <>
            <MultiGuestSeatMedia
              guestUserId={guestUserId}
              guestName={guest.name}
              guestAvatar={guest.avatar}
              isSelf={isSelfTile}
              cameraOn={isSelfTile ? userCameraOn : true}
              remoteVideoByUserId={multiGuestLiveKit.remoteVideoByUserId}
              selfTileAnchorRef={isSelfTile ? selfTileAnchorRef : undefined}
            />
            {merged && merged.extraGuests.length > 0 ? (
              <div className="multi-guest-video-tile-folded-pips" aria-hidden>
                {merged.extraGuests.map(({ seatKey, guest: extraGuest }) => (
                  <img
                    key={seatKey}
                    src={safeAvatarUrl(extraGuest.avatar)}
                    alt=""
                    className="multi-guest-video-tile-folded-pip"
                    title={formatMultiGuestSeatLabel(seatKey, multiGuestSeatCount)}
                  />
                ))}
              </div>
            ) : null}
            <div className="multi-guest-video-tile-overlay" />
            <div className="multi-guest-video-tile-chrome">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenGiftSenders({
                    name: guest.name,
                    userId: guest.userId,
                  });
                }}
                className={`multi-guest-video-tile-coins ${
                  isStaffSeat ? 'multi-guest-video-tile-coins--staff' : ''
                }`}
                aria-label={`View who sent coins to ${guest.name}`}
              >
                <CoinIcon className="multi-guest-video-tile-coins-icon shrink-0" />
                <span className="multi-guest-video-tile-coins-value">{guest.stars.toLocaleString()}</span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (isSelfTile) onToggleUserCamera();
                }}
                disabled={!isSelfTile}
                className={`multi-guest-video-tile-camera ${
                  hasLiveVideo
                    ? 'multi-guest-video-tile-camera--on'
                    : 'multi-guest-video-tile-camera--off'
                }`}
                aria-label={
                  isSelfTile
                    ? hasLiveVideo
                      ? 'Turn camera off'
                      : 'Turn camera on'
                    : `${guest.name} camera ${hasLiveVideo ? 'on' : 'off'}`
                }
              >
                {hasLiveVideo ? <Video size={11} /> : <VideoOff size={11} />}
              </button>
            </div>
            <div className="multi-guest-video-tile-meta">
              <span className="multi-guest-video-tile-name">
                {truncateName(guest.name, slotIndex >= 3 ? 7 : 10)}
              </span>
              <div className="relative z-[5] shrink-0">
                <SeatSpeakingLevelBars
                  active={voiceVisualActive}
                  audioPulse={voicePulse}
                  className="-top-3.5"
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleSeatMic(interactionKey);
                  }}
                  className={`multi-guest-video-tile-mic ${
                    micUnmuted
                      ? voiceVisualActive
                        ? 'multi-guest-video-tile-mic--on multi-guest-video-tile-mic--speaking'
                        : 'multi-guest-video-tile-mic--on'
                      : 'multi-guest-video-tile-mic--off'
                  }`}
                  aria-label={micUnmuted ? `Mute ${guest.name}` : `Unmute ${guest.name}`}
                >
                  {micUnmuted ? <Mic size={11} /> : <MicOff size={11} />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleSelectViewer(buildViewerFromGuest(guest, interactionKey));
              }}
              className="absolute inset-0 z-[1]"
              aria-label={`View ${guest.name} profile`}
            />
          </>
        ) : foldedSeatKeys ? (
          <div className="multi-guest-video-tile-empty multi-guest-video-tile-empty--merged">
            <div className="multi-guest-video-tile-merged-grid multi-guest-video-tile-merged-grid--host-mega">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSeatClick('host');
                }}
                disabled={Boolean(lockedSeats.host) && !activeSeats.host}
                className={`multi-guest-video-tile-merged-slot multi-guest-video-tile-merged-slot--host${
                  lockedSeats.host && !activeSeats.host
                    ? ' multi-guest-video-tile-merged-slot--locked'
                    : ''
                }`}
              >
                {lockedSeats.host && !activeSeats.host ? (
                  <Lock size={14} className="multi-guest-video-tile-empty-icon multi-guest-video-tile-empty-icon--locked" />
                ) : (
                  <Sofa size={16} className="multi-guest-video-tile-empty-icon" />
                )}
                <span className="multi-guest-video-tile-merged-slot-label">HOST</span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSeatClick('coowner');
                }}
                disabled={Boolean(lockedSeats.coowner) && !activeSeats.coowner}
                className={`multi-guest-video-tile-merged-slot multi-guest-video-tile-merged-slot--coowner${
                  lockedSeats.coowner && !activeSeats.coowner
                    ? ' multi-guest-video-tile-merged-slot--locked'
                    : ''
                }`}
              >
                {lockedSeats.coowner && !activeSeats.coowner ? (
                  <Lock size={14} className="multi-guest-video-tile-empty-icon multi-guest-video-tile-empty-icon--locked" />
                ) : (
                  <Sofa size={16} className="multi-guest-video-tile-empty-icon" />
                )}
                <span className="multi-guest-video-tile-merged-slot-label">CO-OWNER</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="multi-guest-video-tile-empty">
            <div
              className={`multi-guest-video-tile-empty-marker${
                isLocked ? ' multi-guest-video-tile-empty-marker--locked' : ''
              }`}
            >
              {isLocked ? (
                <Lock size={16} className="multi-guest-video-tile-empty-icon multi-guest-video-tile-empty-icon--locked" />
              ) : (
                <Sofa size={18} className="multi-guest-video-tile-empty-icon" />
              )}
              <span className="multi-guest-video-tile-label">{label}</span>
            </div>
          </div>
        )}
      </button>
    );
  };

  return (
    <div
      className={`multi-guest-layout relative flex h-full min-h-0 flex-1 flex-col w-full font-sans ${
        effectsPanelOpen || beautyPanelOpen ? 'overflow-visible' : 'overflow-hidden'
      }`}
    >
      <RoomBackgroundLayer mode={backgroundMode} />
      <div
        className={`multi-guest-shell relative z-10 flex h-full min-h-0 flex-1 flex-col w-full ${
          effectsPanelOpen || beautyPanelOpen ? 'overflow-visible' : 'overflow-hidden'
        }`}
      >
        <header className="multi-guest-header relative z-50 flex shrink-0 flex-col gap-1 bg-gradient-to-b from-black/90 via-black/80 to-transparent px-3 pb-1 pt-2 sm:px-4 sm:pt-3">
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
            <RoomOwnerSocialControls
              name={activeSeats.host?.name ?? ownerSocial.ownerIdentity.name}
              avatarUrl={activeSeats.host?.avatar ?? ownerSocial.ownerIdentity.avatarUrl}
              starCount={activeSeats.host?.stars ?? ownerSocial.starCount}
              isSpeaking={Boolean(activeSeats.host?.isSpeaking)}
              isFollowing={ownerSocial.isFollowingOwner}
              onToggleFollow={ownerSocial.toggleFollowOwner}
              showFollowButton={!ownerSocial.isSelfOwner}
              onProfileClick={() =>
                handleSelectViewer(
                  activeSeats.host
                    ? buildViewerFromGuest(activeSeats.host, 'host')
                    : ownerSocial.ownerViewerPayload,
                )
              }
              className="shrink-0"
            />
            <button
              type="button"
              onClick={onOpenRoomDetails}
              className="flex shrink-0 items-center rounded-full px-2 py-0.5 text-[8.5px] font-bold text-teal-400 backdrop-blur transition hover:bg-purple-950/20 active:scale-95"
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
            >
              <CoinIcon className="mr-0.5 h-2 w-2 shrink-0" />
              <span>{roomGiftSummary.totalStars.toLocaleString()}</span>
              <ChevronRight size={8} className="ml-0.5 text-pink-400" />
            </button>
          </div>
        </header>

        <div ref={stageRef} className="multi-guest-stage relative z-20 min-h-0 overflow-hidden">
          <div className={`multi-guest-video-grid ${videoGridClass}`}>
            {videoLayout.map((item, index) => renderTile(item, index))}
          </div>
          {rawVideoRef && deeparPreviewRef ? (
            <MultiGuestSelfMediaHost
              stageRef={stageRef}
              anchorRef={selfTileAnchorRef}
              seatKey={userSeatKey}
              mounted={Boolean(userSeatKey)}
              visible={Boolean(userSeatKey && userCameraOn)}
              rawVideoRef={rawVideoRef}
              deeparPreviewRef={deeparPreviewRef}
              showDeeparPreview={showDeeparPreview}
              deeparWarm={effectsConfigured && Boolean(userSeatKey)}
              mirrorSelf={selfUsesCssMirror}
              beautyVideoRef={beautyVideoRef}
              showBeautyPreview={showBeautyPreview}
              beautyFilter={beautyCssFilter}
            />
          ) : null}
        </div>

        <div
          className={`multi-guest-conversation relative z-30 flex min-h-0 flex-col ${
            effectsPanelOpen || beautyPanelOpen ? 'overflow-visible' : 'overflow-hidden'
          }`}
        >
          <div
            id="chat_and_action_container"
            className="party-chat-grid room-conversation flex min-h-0 flex-1 overflow-hidden px-3 sm:px-4 pt-1 pb-0"
          >
            <div
              id="chat-feed-module"
              className="multi-guest-chat relative flex min-h-0 min-w-0 flex-1 flex-col justify-end overflow-hidden pt-1 pb-1"
            >
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="multi-guest-chat-scroll party-chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hide"
              >
                <div className="multi-guest-chat-feed mt-auto flex w-full flex-col items-start gap-2 pb-1 pt-0.5">
                  {liveChatMsgs.map((msg, idx) => {
                    const messageId = msg.id ?? idx;
                    const wrap = (node: React.ReactNode) => (
                      <div key={messageId} className="flex w-full justify-start text-left">
                        {node}
                      </div>
                    );

                    if (msg.isAnnouncementWelcome) {
                      return wrap(renderAnnouncementWelcome({ ...msg, id: messageId }));
                    }
                    if (msg.isSystem) {
                      return wrap(
                        <div className="mx-0 w-fit max-w-full rounded-full border border-purple-500/20 bg-purple-950/30 px-3 py-1 text-center text-[10px] font-bold text-purple-200/90">
                          {msg.text}
                        </div>,
                      );
                    }
                    if (msg.isSingEvent) return wrap(renderSingChatEvent({ ...msg, id: messageId }));
                    if (msg.isJoinEvent) return wrap(renderJoinChatEvent({ ...msg, id: messageId }));
                    if (msg.isGiftEvent) return wrap(renderGiftChatEvent({ ...msg, id: messageId }));
                    return wrap(
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
            id="multi-guest-footer"
            ref={footerRef}
            className="multi-guest-footer relative z-50 shrink-0 border-t border-white/5 bg-black/30 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:px-4"
          >
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
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
                showCamera
                userCameraOn={userCameraOn}
                onToggleUserCamera={onToggleUserCamera}
                cameraFacingMode={cameraFacingMode}
                onToggleCameraFacing={onToggleCameraFacing}
                showDeepAR={showDeepARControls}
                effectsPanelOpen={effectsPanelOpen}
                deeparEffectActive={deeparEffectActive}
                onToggleEffectsPanel={onToggleEffectsPanel}
                showBeauty={showBeautyControls}
                beautyPanelOpen={beautyPanelOpen}
                beautyActive={beautyActive}
                onToggleBeautyPanel={onToggleBeautyPanel}
                onPkClick={onPkClick}
                onGameClick={onGameClick}
                micAccent="purple"
              />
            </div>
          </div>
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
          anchorBottom={footerHeight}
          webarConfigured={beautyConfigured}
          webarLoading={beautyLoading}
          webarError={beautyError}
        />
      ) : null}

      {showDeepARControls && onToggleEffectsPanel ? (
        <MultiGuestEffectsSheet
          isOpen={effectsPanelOpen}
          onClose={onToggleEffectsPanel}
          activeEffectId={activeEffectId}
          onSelectEffect={onSelectEffect}
          activeSelection={activeDeeparSelection}
          onSelectionChange={onDeeparSelectionChange}
          bodyShape={beautyBodyShape}
          onBodyShapeChange={onBeautyBodyShapeChange}
          loading={effectsLoading}
          cameraReady={effectsCameraReady}
          anchorBottom={footerHeight}
        />
      ) : null}
    </div>
  );
};

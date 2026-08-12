import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import {
  LayoutGrid,
  Check,
  Copy,
  Lock,
  LogOut,
  Mic,
  MicOff,
  Pencil,
  Send,
  Sofa,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import { DEEPAR_ENABLED } from '../../lib/deepar/deeparEnabled';
import { RoomBackgroundLayer } from './RoomBackgroundLayer';
import { RoomFooterTrayActions } from './RoomFooterTrayActions';
import { RoomHeaderActionsMenu, createSingHeaderMenuItem, createYoutubeMiniHeaderMenuItem, type RoomHeaderMenuItem } from './RoomHeaderActionsMenu';
import { RoomHeaderYoutubeMiniButton } from './RoomHeaderYoutubeMiniButton';
import { RoomOwnerSocialControls } from './RoomOwnerSocialControls';
import { RoomArenaOpenButton } from './RoomArenaLeaderboard';
import { SoloLiveVideoStage } from './SoloLiveVideoStage';
import { MultiGuestEffectsSheet } from './MultiGuestEffectsSheet';
import { LiveBeautySheet } from './LiveBeautySheet';
import { MultiGuestSeatMedia } from './MultiGuestSeatMedia';
import { MultiGuestSelfMediaHost } from './MultiGuestSelfMediaHost';
import { PKBattleStage } from './PKBattleStage';
import { LiveSeatFullscreenOverlay, type LiveSeatFullscreenTarget } from './LiveSeatFullscreenOverlay';
import { SeatSpeakingLevelBars } from './SeatVoiceVisuals';
import { useSeatTileTap } from '../hooks/useSeatTileTap';
import { buildLiveSeatFullscreenTarget } from '../utils/liveSeatFullscreenTarget';
import type { CameraFacingMode } from '../../lib/camera/useCameraStream';
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
import { EMPTY_PK_AUDIO_SEATS } from '../utils/pkBattleLayout';
import type { PKBattleState, PKPayload } from '../utils/liveRoomTypes';
import type { RoomExpProgress } from '../utils/roomExp';
import type { RoomGiftSummary } from '../utils/roomGifts';
import {
  SOLO_LIVE_GUEST_SEAT_KEYS,
  formatGuestSeatNumber,
  isSoloLiveGuestSeat,
  resolveSeatGuestDisplay,
  type PartySeatMap,
  type RoomGuest,
  type RoomSeatKey,
} from '../utils/roomSeats';
import type { RoomViewerEntry } from '../utils/roomViewers';
import { safeAvatarUrl } from '../../lib/safe';
import { CommerceLivePanel } from './CommerceLivePanel';
import { CommerceLiveProductCard } from './CommerceLiveProductCard';
import { CommerceLiveCheckoutModal } from './CommerceLiveCheckoutModal';
import type { CommerceCheckoutResult } from './CommerceLiveCheckoutModal';
import { CommerceLiveOrderDetailSheet } from './CommerceLiveOrderDetailSheet';
import type { CommerceCardPosition, CommerceOrder, CommercePayload, CommerceProduct } from '../utils/liveRoomTypes';

type ChatViewerPayload = {
  id: string;
  name: string;
  avatar: string;
  isOwner?: boolean;
  isAdmin?: boolean;
  isFollowing?: boolean;
  mentionLabel?: string;
};

type LiveChatMsg = {
  id?: string | number;
  user?: string;
  userId?: string;
  text?: string;
  isSystem?: boolean;
  isJoinEvent?: boolean;
  isSingEvent?: 'start' | 'end';
  songTitle?: string;
  score?: number;
  isGiftEvent?: boolean;
  isAnnouncementWelcome?: boolean;
  targetViewerId?: string;
  targetViewerName?: string;
  targetViewerAvatar?: string;
};

export type SoloLiveViewProps = {
  roomDisplayId: string;
  roomTitle: string;
  announcement: string;
  isRoomSaved: boolean;
  roomIdCopied: boolean;
  onCopyRoomId: (event: React.MouseEvent) => void;
  onToggleSaveRoom: (event: React.MouseEvent) => void;
  onLeaveRoom: () => void;
  onOpenRoomDetails: () => void;
  onOpenRoomEdit?: () => void;
  activeSeats: PartySeatMap;
  viewers: RoomViewerEntry[];
  roomExpProgress: RoomExpProgress;
  roomGiftSummary: RoomGiftSummary;
  handleSeatClick: (seatKey: string) => void;
  handleToggleSeatMic: (seatKey: string) => void;
  handleSelectViewer: (viewer: ChatViewerPayload) => void;
  buildViewerFromGuest: (guest: RoomGuest, seatKey: string) => ChatViewerPayload;
  onOpenGiftSenders: (receiver: { name: string; userId?: string }) => void;
  lockedSeats: Record<string, boolean>;
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
  userMicLevel?: number;
  audioPulse?: number;
  onOpenArenaRankings: () => void;
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
  effectsConfigured?: boolean;
  effectsPanelOpen?: boolean;
  onToggleEffectsPanel?: () => void;
  activeEffectId?: string;
  onSelectEffect?: (effectId: string) => void;
  activeDeeparSelection?: DeepAREffectSelection;
  onDeeparSelectionChange?: (selection: DeepAREffectSelection) => void;
  effectsLoading?: boolean;
  effectsCameraReady?: boolean;
  cameraError?: string | null;
  onRetryCamera?: () => void;
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
  pkEnabled?: boolean;
  pkBattle?: PKBattleState | null;
  onEmitPk?: (payload: PKPayload) => void;
  onStartPk?: () => void;
  onDisconnectPk?: () => void;
  pkSelfUserId?: string;
  pkIsOwner?: boolean;
  showVoiceChanger?: boolean;
  voiceChangerEligible?: boolean;
  voiceChangerOpen?: boolean;
  voiceEffectActive?: boolean;
  voiceEffectEmoji?: string;
  onToggleVoiceChanger?: () => void;
  isSelfHost: boolean;
  isCommerceLive?: boolean;
  commerceShopOpen?: boolean;
  commerceCatalog?: CommerceProduct[];
  commercePinnedProduct?: CommerceProduct | null;
  commerceCardPosition?: CommerceCardPosition;
  commerceOrders?: CommerceOrder[];
  commerceCheckoutProduct?: CommerceProduct | null;
  commerceSelectedOrder?: CommerceOrder | null;
  commerceSalesCount?: number;
  commerceLastEvent?: CommercePayload | null;
  onToggleCommerceShop?: () => void;
  onCommercePin?: (product: CommerceProduct) => void;
  onCommerceUnpin?: () => void;
  onCommercePurchase?: (product: CommerceProduct) => void;
  onCommerceCreateProduct?: (product: CommerceProduct) => void;
  onCommerceCardPositionChange?: (position: CommerceCardPosition) => void;
  onCommerceCheckoutClose?: () => void;
  onCommerceCheckoutComplete?: (result: CommerceCheckoutResult) => void;
  onCommerceSelectOrder?: (order: CommerceOrder) => void;
  onCommerceCloseOrderDetail?: () => void;
  buyerUserId?: string;
  buyerDisplayName?: string;
  commerceHostUserId?: string;
};

function playVideoElement(element: HTMLVideoElement) {
  element.muted = true;
  element.playsInline = true;
  void element.play().catch(() => {});
}

export const SoloLiveView: React.FC<SoloLiveViewProps> = ({
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
  handleSelectViewer,
  buildViewerFromGuest,
  onOpenGiftSenders,
  lockedSeats,
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
  userMicLevel = 0,
  audioPulse = 0,
  onOpenArenaRankings,
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
  effectsConfigured = false,
  effectsPanelOpen = false,
  onToggleEffectsPanel,
  activeEffectId = 'none',
  activeDeeparSelection,
  onDeeparSelectionChange,
  onOpenSing,
  hasActiveSong = false,
  songQueueLength = 0,
  hideSingMenu = false,
  onPkClick,
  onGameClick,
  pkEnabled = false,
  pkBattle = null,
  onEmitPk,
  onStartPk,
  onDisconnectPk,
  pkSelfUserId = '',
  pkIsOwner = false,
  showVoiceChanger = false,
  voiceChangerEligible = false,
  voiceChangerOpen = false,
  voiceEffectActive = false,
  voiceEffectEmoji,
  onToggleVoiceChanger,
  isSelfHost,
  isCommerceLive = false,
  commerceShopOpen = false,
  commerceCatalog = [],
  commercePinnedProduct = null,
  commerceCardPosition = { x: 50, y: 72 },
  commerceOrders = [],
  commerceCheckoutProduct = null,
  commerceSelectedOrder = null,
  commerceSalesCount = 0,
  commerceLastEvent = null,
  onToggleCommerceShop,
  onCommercePin,
  onCommerceUnpin,
  onCommercePurchase,
  onCommerceCreateProduct,
  onCommerceCardPositionChange,
  onCommerceCheckoutClose,
  onCommerceCheckoutComplete,
  onCommerceSelectOrder,
  onCommerceCloseOrderDetail,
  buyerUserId = '',
  buyerDisplayName = '',
  commerceHostUserId = '',
  effectsLoading = false,
  effectsCameraReady = false,
  cameraError = null,
  onRetryCamera,
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
  onSelectEffect,
}) => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const guestStageRef = useRef<HTMLDivElement>(null);
  const arenaSlotRef = useRef<HTMLDivElement>(null);
  const selfGuestAnchorRef = useRef<HTMLDivElement>(null);
  const deeparEffectActive = effectsConfigured && (
    activeDeeparSelection
      ? deeparSelectionActive(activeDeeparSelection)
      : activeEffectId !== 'none'
  );
  const showDeepARControls = DEEPAR_ENABLED && Boolean(
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
        beautyEffects.backgroundUrl ||
        beautyEffects.shapeEffectId,
    );
  const isSelfGuest = Boolean(userSeatKey && isSoloLiveGuestSeat(userSeatKey));
  const isSelfSeated = isSelfHost || isSelfGuest;
  const selfUsesCssMirror =
    cameraFacingMode === 'user' &&
    !(effectsConfigured && deeparEffectActive && effectsArReady);
  const selfCameraActive = isSelfHost && userCameraOn;
  const selfMediaMounted = isSelfHost;

  const hostGuest = activeSeats.host;
  const hostUserId = hostGuest ? resolveSeatVideoUserId(hostGuest, roomDisplayId) : null;
  const openSeatFullscreen = (seatKey: RoomSeatKey, guest: RoomGuest) => {
    setSeatFullscreenTarget(
      buildLiveSeatFullscreenTarget(seatKey, guest, roomDisplayId, {
        userSeatKey,
        selfUserId: pkSelfUserId,
      }),
    );
  };
  const hostRemoteTrack =
    !isSelfHost && hostUserId ? multiGuestLiveKit.remoteVideoByUserId.get(hostUserId) ?? null : null;

  useEffect(() => {
    if (isSelfHost || !hostRemoteTrack) return undefined;
    const element = remoteVideoRef.current;
    if (!element || hostRemoteTrack.kind !== Track.Kind.Video) return undefined;
    hostRemoteTrack.attach(element);
    playVideoElement(element);
    return () => {
      hostRemoteTrack.detach(element);
    };
  }, [hostRemoteTrack, isSelfHost]);

  const headerMenuItems = useMemo<RoomHeaderMenuItem[]>(
    () => [
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
      createYoutubeMiniHeaderMenuItem(),
    ],
    [
      canChangeRoomMode,
      hasActiveSong,
      hideSingMenu,
      onOpenRoomModePicker,
      onOpenSing,
      songQueueLength,
    ],
  );

  const showHostRemote = !isSelfHost && Boolean(hostRemoteTrack);
  const showStatusText =
    !showHostRemote &&
    (isSelfHost ? !userCameraOn || !effectsCameraReady : true);

  // Poster always available for viewers (and host before camera) — LiveKit upgrades on top.
  const hostPoster = useMemo(() => {
    if (selfCameraActive || !hostGuest) return null;
    return { name: hostGuest.name, avatar: hostGuest.avatar };
  }, [selfCameraActive, hostGuest?.name, hostGuest?.avatar]);

  const statusText = useMemo(() => {
    if (!showStatusText) return '';
    if (!isSelfHost) return 'Waiting for host to go live';
    if (!userCameraOn) return 'Turn on your camera to go live';
    if (cameraError) return cameraError;
    return 'Starting camera…';
  }, [cameraError, isSelfHost, showStatusText, userCameraOn]);

  const videoStageProps = useMemo(
    () => ({
      selfMediaMounted,
      selfCameraActive,
      mirrorSelf: selfUsesCssMirror,
      showDeeparPreview,
      beautyVideoRef,
      showBeautyPreview,
      beautyFilter: beautyCssFilter,
      showHostRemote,
      showStatusText,
      statusText,
      onRetryCamera: cameraError ? onRetryCamera : undefined,
      hostPoster,
    }),
    [
      selfMediaMounted,
      selfCameraActive,
      selfUsesCssMirror,
      showDeeparPreview,
      beautyVideoRef,
      showBeautyPreview,
      beautyCssFilter,
      showHostRemote,
      showStatusText,
      statusText,
      cameraError,
      onRetryCamera,
      hostPoster,
    ],
  );
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const handleSeatTileTap = useSeatTileTap();
  const [seatFullscreenTarget, setSeatFullscreenTarget] = useState<LiveSeatFullscreenTarget | null>(
    null,
  );

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
  }, [beautyPanelOpen, effectsPanelOpen]);

  const panelAnchorBottom = Math.max(footerHeight, 104) + 6;

  const renderGuestSeat = (seatKey: RoomSeatKey) => {
    const rawGuest = activeSeats[seatKey];
    const guest = rawGuest ? resolveSeatGuestDisplay(rawGuest, roomDisplayId) : null;
    const isLocked = Boolean(lockedSeats[seatKey]) && !guest;
    const isSelfTile = userSeatKey === seatKey;
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
    const label = `NO.${formatGuestSeatNumber(seatKey)}`;

    const hostCannotTakeGuestSeat = isSelfHost && !guest;

    const handleTileActivate = () => {
      if (hostCannotTakeGuestSeat) return;
      if (!guest || !rawGuest) {
        handleSeatClick(seatKey);
        return;
      }
      handleSeatTileTap(
        () => handleSeatClick(seatKey),
        () => openSeatFullscreen(seatKey, rawGuest),
      );
    };

    return (
      <div
        key={seatKey}
        role="button"
        tabIndex={hostCannotTakeGuestSeat ? -1 : 0}
        onClick={handleTileActivate}
        onKeyDown={(event) => {
          if (hostCannotTakeGuestSeat) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleTileActivate();
          }
        }}
        aria-disabled={hostCannotTakeGuestSeat}
        className={`solo-live-guest-tile group text-left cursor-pointer${
          hostCannotTakeGuestSeat ? ' solo-live-guest-tile--host-locked' : ''
        }`}
        aria-label={
          hostCannotTakeGuestSeat
            ? `${label} — guest co-host seat`
            : guest
              ? `Send gift to ${guest.name}`
              : `Join ${label}`
        }
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
              selfTileAnchorRef={isSelfTile ? selfGuestAnchorRef : undefined}
            />
            <div className="solo-live-guest-tile-overlay" />
            <div className="solo-live-guest-tile-chrome">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenGiftSenders({
                    name: guest.name,
                    userId: guest.userId,
                  });
                }}
                className="multi-guest-video-tile-coins"
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
                className={`solo-live-guest-tile-camera ${
                  hasLiveVideo
                    ? 'solo-live-guest-tile-camera--on'
                    : 'solo-live-guest-tile-camera--off'
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
            <div className="solo-live-guest-tile-meta">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSelectViewer(buildViewerFromGuest(guest, seatKey));
                }}
                className="solo-live-guest-tile-name text-left hover:underline"
                aria-label={`View ${guest.name} profile`}
              >
                {guest.name}
              </button>
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
                    handleToggleSeatMic(seatKey);
                  }}
                  className={`solo-live-guest-tile-mic ${
                    micUnmuted
                      ? voiceVisualActive
                        ? 'solo-live-guest-tile-mic--live'
                        : 'solo-live-guest-tile-mic--on'
                      : 'solo-live-guest-tile-mic--off'
                  }`}
                  aria-label={micUnmuted ? `Mute ${guest.name}` : `Unmute ${guest.name}`}
                >
                  {micUnmuted ? <Mic size={10} /> : <MicOff size={10} strokeWidth={3} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="solo-live-guest-tile-empty">
            {isLocked ? (
              <Lock size={16} className="text-red-400" />
            ) : (
              <Sofa size={18} className="text-white/55" />
            )}
            <span className="solo-live-guest-tile-empty-label">
              {isLocked ? 'Locked' : label}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`solo-live-layout relative flex h-full min-h-0 flex-1 flex-col w-full font-sans ${
        effectsPanelOpen || beautyPanelOpen ? 'overflow-visible' : 'overflow-hidden'
      }`}
    >
      <RoomBackgroundLayer mode={backgroundMode} />
      <div
        className={`solo-live-shell relative h-full min-h-0 w-full flex-1 ${
          effectsPanelOpen || beautyPanelOpen ? 'overflow-visible' : 'overflow-hidden'
        }`}
      >
        <SoloLiveVideoStage
          {...videoStageProps}
          rawVideoRef={rawVideoRef}
          deeparPreviewRef={deeparPreviewRef}
          remoteVideoRef={remoteVideoRef}
        />
        {hostGuest ? (
          <button
            type="button"
            className="absolute inset-0 z-[2] cursor-default border-none bg-transparent p-0"
            aria-label={`${hostGuest.name} live camera — double tap for fullscreen`}
            onClick={() =>
              handleSeatTileTap(
                () => {},
                () => openSeatFullscreen('host', hostGuest),
              )
            }
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-[35]">
          {isCommerceLive &&
          commercePinnedProduct &&
          onCommercePurchase &&
          onCommerceCardPositionChange ? (
            <CommerceLiveProductCard
              product={commercePinnedProduct}
              salesCount={commerceSalesCount}
              isHost={isSelfHost}
              position={commerceCardPosition}
              onBuy={() => onCommercePurchase(commercePinnedProduct)}
              onUnpin={isSelfHost ? onCommerceUnpin : undefined}
              onPositionChange={onCommerceCardPositionChange}
            />
          ) : null}
        </div>

        <header className="solo-live-header absolute inset-x-0 top-0 z-50 flex flex-col gap-1 overflow-visible bg-gradient-to-b from-black/85 via-black/55 to-transparent px-3 pb-2 pt-2 sm:px-4 sm:pt-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5 overflow-visible pr-0.5">
                <RoomOwnerSocialControls
                  name={hostGuest?.name ?? ownerSocial.ownerIdentity.name}
                  avatarUrl={hostGuest?.avatar ?? ownerSocial.ownerIdentity.avatarUrl}
                  starCount={hostGuest?.stars ?? ownerSocial.starCount}
                  isSpeaking={Boolean(hostGuest?.isSpeaking)}
                  isFollowing={ownerSocial.isFollowingOwner}
                  onToggleFollow={ownerSocial.toggleFollowOwner}
                  showFollowButton={!ownerSocial.isSelfOwner}
                  onProfileClick={() =>
                    handleSelectViewer(
                      hostGuest
                        ? buildViewerFromGuest(hostGuest, 'host')
                        : ownerSocial.ownerViewerPayload,
                    )
                  }
                  className="min-w-0 flex-1 overflow-hidden"
                />
              </div>
              <div className="solo-live-caption inline-flex w-fit max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-0.5 pl-0.5 backdrop-blur-sm">
                <p
                  className="min-w-0 max-w-[9.5rem] truncate text-left text-[11px] font-semibold leading-snug text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:max-w-[12rem]"
                  title={announcement}
                >
                  {announcement.trim() || 'Welcome to the live room'}
                </p>
                <div className="flex shrink-0 items-center gap-0.5 border-l border-white/10 pl-1">
                  {isSelfHost && onEditAnnouncement ? (
                    <button
                      type="button"
                      onClick={onEditAnnouncement}
                      className="shrink-0 rounded-md p-0.5 text-pink-300/90 transition hover:bg-white/10 hover:text-pink-200"
                      title="Edit live caption"
                      aria-label="Edit live caption"
                    >
                      <Pencil size={12} />
                    </button>
                  ) : null}
                  <span className="solo-live-badge shrink-0 whitespace-nowrap leading-none inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/20 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wide text-red-200">
                    <span className="solo-live-badge-dot" aria-hidden />
                    {isCommerceLive ? 'Shop Live' : 'Live'}
                  </span>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-1 pl-0.5">
                <span
                  className="truncate font-mono text-[10px] font-semibold tracking-wide text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                  title={`Live room ID ${roomDisplayId}`}
                >
                  ID:{roomDisplayId}
                </span>
                <button
                  type="button"
                  onClick={onCopyRoomId}
                  className="shrink-0 rounded-md p-0.5 text-white/60 transition hover:bg-white/10 hover:text-white/90"
                  aria-label={roomIdCopied ? 'Live ID copied' : 'Copy live ID'}
                >
                  {roomIdCopied ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>
            <div className="flex shrink-0 items-center space-x-1.5 sm:space-x-2">
              <button
                type="button"
                onClick={() => setIsRoomViewersOpen(true)}
                aria-label={`${viewers.length} viewers in room`}
                className="party-viewers-chip party-glass-chip flex min-h-[32px] shrink-0 cursor-pointer items-center space-x-2 rounded-full px-2.5 py-1.5 sm:px-3 transition"
              >
                <div className="-space-x-2 mr-0.5 flex">
                  {viewers.slice(0, 3).map((viewer) => (
                    <img
                      key={viewer.id}
                      src={safeAvatarUrl(viewer.avatar)}
                      className="h-6 w-6 shrink-0 rounded-full border-2 border-[#07010a] object-cover sm:h-7 sm:w-7"
                      alt=""
                    />
                  ))}
                </div>
                <div className="flex items-center space-x-1.5 opacity-90">
                  <Users size={16} className="shrink-0 text-gray-300" />
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
        </header>

        {pkEnabled && onEmitPk && pkBattle && pkBattle.phase !== 'idle' ? (
          <div className="pointer-events-auto absolute inset-x-2 top-[5.25rem] z-[28] max-h-[38%] sm:inset-x-4">
            <PKBattleStage
              selfUserId={pkSelfUserId}
              battle={pkBattle}
              audioSeats={EMPTY_PK_AUDIO_SEATS}
              isOwner={pkIsOwner}
              onEmitPk={onEmitPk}
              onStartPk={onStartPk}
              onDisconnectPk={onDisconnectPk}
              variant="stage"
              className="overflow-hidden"
            />
          </div>
        ) : null}

        <div
          ref={guestStageRef}
          className="solo-live-guest-rail"
        >
          <div className="solo-live-guest-grid">
            {SOLO_LIVE_GUEST_SEAT_KEYS.map((seatKey) => renderGuestSeat(seatKey))}
          </div>
          {rawVideoRef && deeparPreviewRef && isSelfGuest ? (
            <MultiGuestSelfMediaHost
              stageRef={guestStageRef}
              anchorRef={selfGuestAnchorRef}
              seatKey={userSeatKey}
              active={Boolean(isSelfGuest && userCameraOn)}
              rawVideoRef={rawVideoRef}
              deeparPreviewRef={deeparPreviewRef}
              showDeeparPreview={showDeeparPreview}
              mirrorSelf={selfUsesCssMirror}
              beautyVideoRef={beautyVideoRef}
              showBeautyPreview={showBeautyPreview}
              beautyFilter={beautyCssFilter}
            />
          ) : null}
        </div>

        <div
          className={`solo-live-conversation absolute inset-x-0 bottom-0 z-30 flex max-h-[46%] min-h-0 flex-col ${
            effectsPanelOpen || beautyPanelOpen ? 'overflow-visible' : 'overflow-hidden'
          }`}
        >
          <div
            id="chat_and_action_container"
            className="party-chat-grid room-conversation flex min-h-0 flex-1 overflow-hidden px-3 sm:px-4 pt-1 pb-0"
          >
            <div
              id="chat-feed-module"
              className="solo-live-chat multi-guest-chat relative flex min-h-0 min-w-0 flex-1 flex-col justify-end overflow-hidden pt-1 pb-1"
            >
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="solo-live-chat-scroll multi-guest-chat-scroll party-chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hide"
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
            <div
              ref={arenaSlotRef}
              className="solo-live-arena-slot flex shrink-0 flex-col items-center justify-end self-stretch pb-1"
              id="gameday-widgets-column"
            >
              <RoomArenaOpenButton onOpen={onOpenArenaRankings} />
            </div>
          </div>

          <div
            id="solo-live-footer"
            ref={footerRef}
            className="solo-live-footer relative z-50 shrink-0 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 sm:px-4"
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
                showCamera={isSelfSeated}
                userCameraOn={userCameraOn}
                onToggleUserCamera={onToggleUserCamera}
                showDeepAR={showDeepARControls}
                effectsPanelOpen={effectsPanelOpen}
                deeparEffectActive={deeparEffectActive}
                onToggleEffectsPanel={onToggleEffectsPanel}
                showBeauty={showBeautyControls}
                beautyPanelOpen={beautyPanelOpen}
                beautyActive={beautyActive}
                onToggleBeautyPanel={onToggleBeautyPanel}
                showShop={isCommerceLive && isSelfHost}
                shopPanelOpen={commerceShopOpen}
                shopActive={Boolean(commercePinnedProduct)}
                onToggleShopPanel={isSelfHost ? onToggleCommerceShop : undefined}
                onPkClick={pkEnabled && isSelfHost ? onPkClick : undefined}
                onGameClick={onGameClick}
                showVoiceChanger={showVoiceChanger}
                voiceChangerEligible={voiceChangerEligible}
                voiceChangerOpen={voiceChangerOpen}
                voiceEffectActive={voiceEffectActive}
                voiceEffectEmoji={voiceEffectEmoji}
                onToggleVoiceChanger={onToggleVoiceChanger}
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
          anchorBottom={panelAnchorBottom}
          anchorMode="container"
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
          anchorBottom={panelAnchorBottom}
        />
      ) : null}

      {isSelfHost &&
      isCommerceLive &&
      onCommercePin &&
      onCommerceUnpin &&
      onToggleCommerceShop &&
      onCommerceCreateProduct &&
      onCommerceSelectOrder ? (
        <CommerceLivePanel
          open={commerceShopOpen}
          isHost={isSelfHost}
          catalog={commerceCatalog}
          pinnedProductId={commercePinnedProduct?.id ?? null}
          salesCount={commerceSalesCount}
          orders={commerceOrders}
          lastCommerce={commerceLastEvent}
          onClose={onToggleCommerceShop}
          onPin={onCommercePin}
          onUnpin={onCommerceUnpin}
          onCreateProduct={onCommerceCreateProduct}
          onSelectOrder={onCommerceSelectOrder}
        />
      ) : null}

      {isCommerceLive &&
      commerceCheckoutProduct &&
      onCommerceCheckoutClose &&
      onCommerceCheckoutComplete &&
      buyerUserId ? (
        <CommerceLiveCheckoutModal
          open
          product={commerceCheckoutProduct}
          roomId={roomDisplayId}
          hostUserId={commerceHostUserId}
          buyerUserId={buyerUserId}
          buyerDisplayName={buyerDisplayName}
          onClose={onCommerceCheckoutClose}
          onComplete={onCommerceCheckoutComplete}
        />
      ) : null}

      {isSelfHost && isCommerceLive && commerceSelectedOrder && onCommerceCloseOrderDetail ? (
        <CommerceLiveOrderDetailSheet
          order={commerceSelectedOrder}
          onClose={onCommerceCloseOrderDetail}
        />
      ) : null}

      <LiveSeatFullscreenOverlay
        target={seatFullscreenTarget}
        onClose={() => setSeatFullscreenTarget(null)}
        remoteVideoByUserId={multiGuestLiveKit.remoteVideoByUserId}
        rawVideoRef={rawVideoRef}
        beautyVideoRef={beautyVideoRef}
        showBeautyPreview={showBeautyPreview}
        showDeeparPreview={showDeeparPreview}
        deeparPreviewRef={deeparPreviewRef}
        mirrorSelf={selfUsesCssMirror}
      />
    </div>
  );
};

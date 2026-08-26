import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Track } from '../../lib/rtc/livekitCompatibilityBoundary';
import { subscribeHostMedia } from '../../lib/camera/hostMediaSession';
import type { HostMediaSnapshot } from '../../lib/camera/hostMediaTypes';
import {
  Activity,
  Info,
  LayoutGrid,
  Lock,
  Mic,
  MicOff,
  Music2,
  Pencil,
  Power,
  RefreshCw,
  Settings2,
  Sofa,
  Sparkles,
  Star,
  Users,
  Video,
  VideoOff,
  Wallet,
} from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import { useOptionalLiveLike } from '../liveLike/LiveLikeContext';
import { DEEPAR_ENABLED } from '../../lib/deepar/deeparEnabled';
import { RoomBackgroundLayer } from './RoomBackgroundLayer';
import { RoomHeaderYoutubeMiniButton } from './RoomHeaderYoutubeMiniButton';
import { SoloLiveVideoStage } from './SoloLiveVideoStage';
import { MultiGuestEffectsSheet } from './MultiGuestEffectsSheet';
import { LiveBeautySheet } from './LiveBeautySheet';
import { MultiGuestSeatMedia } from './MultiGuestSeatMedia';
import { MultiGuestSelfMediaHost } from './MultiGuestSelfMediaHost';
import { V15LiveRoomChrome } from './V15LiveRoomChrome';
import { LiveSeatFullscreenOverlay, type LiveSeatFullscreenTarget } from './LiveSeatFullscreenOverlay';
import { SeatSpeakingLevelBars } from './SeatVoiceVisuals';
import { useSeatTileTap } from '../hooks/useSeatTileTap';
import { buildLiveSeatFullscreenTarget } from '../utils/liveSeatFullscreenTarget';
import type { CameraFacingMode } from '../../lib/camera/useCameraStream';
import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import { deeparSelectionActive, type DeepAREffectSelection } from '../../lib/deepar/deeparEffectSelection';
import type {
  TencentBeautifyParams,
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
import { CommerceLiveCheckoutModal } from './CommerceLiveCheckoutModal';
import type { CommerceCheckoutResult } from './CommerceLiveCheckoutModal';
import { CommerceLiveOrderDetailSheet } from './CommerceLiveOrderDetailSheet';
import type { CommerceCardPosition, CommerceOrder, CommercePayload, CommerceProduct } from '../utils/liveRoomTypes';
import {
  SoloShopLiveComposerActions,
  SoloShopLiveControls,
  SoloShopLiveDailyGiftSheet,
  type SoloShopLiveMoreAction,
} from './SoloShopLiveControls';
import { clearActiveLiveQa, publishActiveLiveQa } from '../../lib/live/activeLiveQa';

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
  onToggleSaveRoom: (event?: React.MouseEvent) => void;
  onLeaveRoom: () => void;
  onShareRoom?: () => void;
  onRequestEndLive?: () => void;
  onOpenHostDashboard?: () => void;
  hostLiveMetrics?: import('./HostLiveMetricsStrip').HostLiveMetrics | null;
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
  onOpenStickers?: () => void;
  stickersOpen?: boolean;
  setIsGuestManagementOpen: (open: boolean) => void;
  onOpenGuestManagement?: () => void;
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
  liveFollowCount?: number;
  followerTotal?: number;
  followTappers?: Array<{ userId: string; name: string; avatarUrl?: string; followedThisLive?: boolean }>;
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
  cameraGeneration?: number;
  cameraTrackDiag?: {
    trackIdHash: string;
    facingMode?: string;
    width?: number;
    height?: number;
    frameRate?: number;
    readyState?: string;
  } | null;
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
  onBeautifyParamsChange?: (params: TencentBeautifyParams) => void;
  beautifyOverride?: TencentBeautifyParams | null;
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
  coinBalance?: number;
  onOpenRecharge?: () => void;
  pkTimerLabel?: string | null;
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
  onCommerceMarkShipped?: (order: CommerceOrder) => void;
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
  onShareRoom,
  onRequestEndLive,
  onOpenHostDashboard,
  hostLiveMetrics = null,
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
  setIsRoomViewersOpen,
  setIsGiftPickerOpen,
  onOpenStickers,
  setIsGuestManagementOpen,
  onOpenGuestManagement,
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
  backgroundMode,
  canEditAnnouncement = false,
  onEditAnnouncement,
  canChangeRoomMode = false,
  onOpenRoomModePicker,
  ownerSocial,
  liveFollowCount = 0,
  followerTotal,
  followTappers = [],
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
  coinBalance = 0,
  onOpenRecharge,
  pkTimerLabel = null,
  showVoiceChanger = false,
  voiceChangerEligible = false,
  voiceChangerOpen = false,
  voiceEffectActive = false,
  onToggleVoiceChanger,
  isSelfHost,
  isCommerceLive = false,
  commerceShopOpen = false,
  commerceCatalog = [],
  commercePinnedProduct = null,
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
  onCommerceCheckoutClose,
  onCommerceCheckoutComplete,
  onCommerceSelectOrder,
  onCommerceCloseOrderDetail,
  onCommerceMarkShipped,
  buyerUserId = '',
  buyerDisplayName = '',
  commerceHostUserId = '',
  effectsLoading = false,
  effectsCameraReady = false,
  cameraError = null,
  onRetryCamera,
  effectsArReady = false,
  cameraFacingMode = 'user',
  cameraGeneration = 0,
  cameraTrackDiag = null,
  onToggleCameraFacing,
  beautyEffectId = 'none',
  beautyEffects = EMPTY_TENCENT_EFFECT_SELECTION,
  beautyCatalogs,
  beautyPanelOpen = false,
  onToggleBeautyPanel,
  onSelectBeauty,
  onBeautifyParamsChange,
  beautifyOverride = null,
  onBeautyEffectsChange,
  beautyBodyShape = EMPTY_BODY_SHAPE,
  onBeautyBodyShapeChange,
  onSelectEffect,
}) => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const guestStageRef = useRef<HTMLDivElement>(null);
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
  const isSelfGuest = Boolean(userSeatKey && isSoloLiveGuestSeat(userSeatKey));
  const isSelfSeated = isSelfHost || isSelfGuest;
  const occupiedGuestSeatKeys = useMemo(
    () => SOLO_LIVE_GUEST_SEAT_KEYS.filter((seatKey) => Boolean(activeSeats[seatKey])),
    [activeSeats],
  );
  const selfUsesCssMirror =
    (cameraTrackDiag?.facingMode === 'environment'
      ? false
      : cameraTrackDiag?.facingMode === 'user'
        ? true
        : cameraFacingMode === 'user') &&
    !(effectsConfigured && deeparEffectActive && effectsArReady);
  const selfCameraActive = isSelfHost && userCameraOn;
  const selfMediaMounted = isSelfHost;

  const hostGuest = activeSeats.host;
  const liveFeaturedProduct = commercePinnedProduct ?? commerceCatalog[0] ?? null;
  const hostUserId = hostGuest ? resolveSeatVideoUserId(hostGuest, roomDisplayId) : null;
  const openSeatFullscreen = (seatKey: RoomSeatKey, guest: RoomGuest) => {
    setSeatFullscreenTarget(
      buildLiveSeatFullscreenTarget(seatKey, guest, roomDisplayId, {
        userSeatKey,
        selfUserId: buyerUserId,
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

  const hostEndLiveOnly = isSelfHost || Boolean(onRequestEndLive);

  const moreActions = useMemo<SoloShopLiveMoreAction[]>(
    () => [
      {
        id: 'seat',
        label: userSeatKey ? 'Leave Seat' : 'Join Guest',
        icon: <Users size={17} aria-hidden />,
        onClick: onToggleSeatParticipation,
        hidden: isSelfHost,
      },
      {
        id: 'switch-camera',
        label: 'Switch Camera',
        icon: <RefreshCw size={17} aria-hidden />,
        onClick: () => onToggleCameraFacing?.(),
        hidden: !isSelfSeated || !onToggleCameraFacing,
      },
      {
        id: 'ar-effects',
        label: 'AR Effects',
        icon: <Sparkles size={17} aria-hidden />,
        onClick: () => onToggleEffectsPanel?.(),
        hidden: !showDeepARControls,
      },
      {
        id: 'voice-changer',
        label: 'Voice Changer',
        icon: <Mic size={17} aria-hidden />,
        onClick: () => onToggleVoiceChanger?.(),
        hidden: !showVoiceChanger || !onToggleVoiceChanger,
        disabled: !voiceChangerEligible,
      },
      {
        id: 'save-room',
        label: isRoomSaved ? 'Room Saved' : 'Save Room',
        icon: <Star size={17} aria-hidden />,
        onClick: () => onToggleSaveRoom(),
      },
      {
        id: 'game',
        label: 'Game',
        icon: <LayoutGrid size={17} aria-hidden />,
        onClick: () => onGameClick?.(),
        hidden: !isCommerceLive || !onGameClick,
      },
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
            {
              id: 'sing',
              label: hasActiveSong ? 'Now Singing' : songQueueLength > 0 ? `Sing (${songQueueLength})` : 'Sing',
              icon: <Music2 size={17} aria-hidden />,
              onClick: onOpenSing,
              hidden: hideSingMenu,
            },
          ]
        : []),
      {
        id: 'announcement',
        label: 'Edit announcement',
        icon: <Pencil size={15} aria-hidden />,
        onClick: () => onEditAnnouncement?.(),
        hidden: !canEditAnnouncement || !onEditAnnouncement,
      },
      {
        id: 'host-dashboard',
        label: 'Live dashboard',
        icon: <Activity size={15} aria-hidden />,
        onClick: () => onOpenHostDashboard?.(),
        hidden: !onOpenHostDashboard,
      },
      {
        id: 'recharge',
        label: coinBalance > 0 ? `Recharge (${coinBalance.toLocaleString()})` : 'Recharge',
        icon: <Wallet size={17} aria-hidden />,
        onClick: () => onOpenRecharge?.(),
        hidden: !onOpenRecharge,
      },
      {
        id: 'end-live',
        label: hostEndLiveOnly ? 'End Live' : 'Leave Live',
        icon: <Power size={15} aria-hidden />,
        onClick: hostEndLiveOnly && onRequestEndLive ? onRequestEndLive : onLeaveRoom,
        danger: true,
      },
    ],
    [
      canChangeRoomMode,
      canEditAnnouncement,
      coinBalance,
      hasActiveSong,
      hideSingMenu,
      hostEndLiveOnly,
      isRoomSaved,
      isCommerceLive,
      isSelfHost,
      isSelfSeated,
      onGameClick,
      onEditAnnouncement,
      onOpenHostDashboard,
      onOpenRecharge,
      onOpenRoomDetails,
      onOpenRoomEdit,
      onOpenRoomModePicker,
      onOpenSing,
      onRequestEndLive,
      onLeaveRoom,
      onToggleCameraFacing,
      onToggleEffectsPanel,
      onToggleSeatParticipation,
      onToggleSaveRoom,
      onToggleVoiceChanger,
      showDeepARControls,
      showVoiceChanger,
      songQueueLength,
      userSeatKey,
      voiceChangerEligible,
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
  const stageShellRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const handleSeatTileTap = useSeatTileTap();
  const liveLike = useOptionalLiveLike();
  const [chatComposerOpen, setChatComposerOpen] = useState(true);
  const [dailyGiftOpen, setDailyGiftOpen] = useState(false);
  const [seatFullscreenTarget, setSeatFullscreenTarget] = useState<LiveSeatFullscreenTarget | null>(
    null,
  );
  const [hostMediaSnap, setHostMediaSnap] = useState<HostMediaSnapshot | null>(null);

  useEffect(() => subscribeHostMedia(setHostMediaSnap), []);

  useEffect(() => {
    try {
      const w = window as Window & { __UNILIVE_CREATE_ROOM_DEBUG__?: unknown };
      w.__UNILIVE_CREATE_ROOM_DEBUG__ = {
        step: 'SOLO_VIEW_MOUNTED',
        at: Date.now(),
        roomId: roomDisplayId,
      };
      console.info('[SoloLiveView]', 'SOLO_VIEW_MOUNTED', { roomId: roomDisplayId });
    } catch {
      /* ignore */
    }
  }, [roomDisplayId]);

  const liveQaState = cameraError
    ? 'live-error-state'
    : hostMediaSnap?.state === 'permission-required'
      ? 'live-permission-camera-pending'
      : hostMediaSnap?.connecting
        ? 'live-rtc-connecting'
        : hostMediaSnap?.live || hostMediaSnap?.publishing
          ? 'live-rtc-connected'
          : 'solo-live-view';

  useEffect(() => {
    if (!roomDisplayId) {
      clearActiveLiveQa();
      return undefined;
    }
    publishActiveLiveQa({
      appRoomId: roomDisplayId,
      roomType: isCommerceLive ? 'commerce' : 'solo',
      hostPersonId: hostUserId || null,
      liveState: liveQaState,
      rtcState: hostMediaSnap?.live || hostMediaSnap?.publishing
        ? 'connected'
        : hostMediaSnap?.connecting
          ? 'connecting'
          : 'idle',
      rtcRoomName: roomDisplayId,
    });
    return () => {
      clearActiveLiveQa();
    };
  }, [
    roomDisplayId,
    isCommerceLive,
    hostUserId,
    liveQaState,
    hostMediaSnap?.live,
    hostMediaSnap?.publishing,
    hostMediaSnap?.connecting,
  ]);

  const tapLikeAtClientPoint = (clientX: number, clientY: number) => {
    if (!liveLike) return;
    const stage =
      (stageShellRef.current?.closest('.room-shell') as HTMLElement | null) ??
      stageShellRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    liveLike.tapLike({
      xPct: ((clientX - rect.left) / Math.max(1, rect.width)) * 100,
      yPct: ((clientY - rect.top) / Math.max(1, rect.height)) * 100,
    });
  };

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
        }${guest ? '' : ' solo-live-guest-tile--empty'}`}
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

  // Landmarks must reflect ACTUAL track settings when available (not requested-only state).
  const actualFacing: CameraFacingMode =
    cameraTrackDiag?.facingMode === 'environment' || cameraTrackDiag?.facingMode === 'user'
      ? cameraTrackDiag.facingMode
      : cameraFacingMode;
  const cameraFacingLandmark =
    actualFacing === 'environment' ? 'camera-facing-rear' : 'camera-facing-front';
  const cameraGenerationLandmark =
    cameraGeneration > 0 ? `camera-source-generation-${cameraGeneration}` : 'camera-source-generation-0';

  return (
    <div
      className={`solo-live-layout relative flex h-full min-h-0 flex-1 flex-col w-full font-sans ${
        effectsPanelOpen || beautyPanelOpen ? 'overflow-visible' : 'overflow-hidden'
      }`}
      style={
        {
          ['--approved-live-footer-height' as string]: `${Math.max(footerHeight, 104)}px`,
          ['--solo-live-guest-rail-bottom' as string]: `${Math.max(footerHeight, 104) + 10}px`,
        } as React.CSSProperties
      }
      data-live-qa-state={liveQaState}
      data-live-qa-host-media={hostMediaSnap?.state ?? 'unknown'}
      data-live-qa-chat-open={chatComposerOpen ? '1' : '0'}
      data-live-qa-room-id={roomDisplayId || ''}
      data-live-qa-camera-facing={actualFacing === 'environment' ? 'rear' : 'front'}
      data-live-qa-camera-generation={String(cameraGeneration || 0)}
      data-live-qa-camera-facing-mode={actualFacing}
      data-live-qa-camera-width={cameraTrackDiag?.width != null ? String(cameraTrackDiag.width) : ''}
      data-live-qa-camera-height={cameraTrackDiag?.height != null ? String(cameraTrackDiag.height) : ''}
      aria-label={
        roomDisplayId
          ? `${liveQaState} live-room-id-${roomDisplayId}`
          : liveQaState
      }
    >
      <span
        className="sr-only"
        aria-label={cameraFacingLandmark}
        data-live-qa-camera-facing={actualFacing === 'environment' ? 'rear' : 'front'}
      />
      <span className="sr-only" aria-label={cameraGenerationLandmark} />
      <span
        className="sr-only"
        aria-label={hostMediaSnap?.publishing || hostMediaSnap?.live ? 'camera-rtc-published' : 'camera-rtc-idle'}
      />
      {roomDisplayId ? (
        <span className="sr-only" aria-label={`live-room-id-${roomDisplayId}`} data-live-qa-room-id={roomDisplayId} />
      ) : null}
      <RoomBackgroundLayer mode={backgroundMode} />
      <div
        ref={stageShellRef}
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
            aria-label={`${hostGuest.name} live camera — tap to like, double tap for fullscreen`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              tapLikeAtClientPoint(event.clientX, event.clientY);
            }}
            onClick={() => {
              handleSeatTileTap(
                () => {},
                () => openSeatFullscreen('host', hostGuest),
              );
            }}
          />
        ) : null}

        <div className="approved-live-overlay-canvas">
        {/* Host close: aria-label="End Live". Viewer close: aria-label="Leave room". */}
        <V15LiveRoomChrome
          hostName={hostGuest?.name ?? ownerSocial.ownerIdentity.name}
          hostAvatarUrl={hostGuest?.avatar ?? ownerSocial.ownerIdentity.avatarUrl}
          roomId={roomDisplayId}
          caption={announcement.trim() || roomTitle.trim() || undefined}
          canEditCaption={canEditAnnouncement}
          onEditCaption={onEditAnnouncement}
          roomIdCopied={roomIdCopied}
          onCopyRoomId={onCopyRoomId}
          popularityLabel={
            hostGuest?.stars != null && hostGuest.stars > 0
              ? hostGuest.stars.toLocaleString()
              : ownerSocial.starCount > 0
                ? ownerSocial.starCount.toLocaleString()
                : undefined
          }
          isFollowing={ownerSocial.isFollowingOwner}
          showFollow={!ownerSocial.isSelfOwner}
          onToggleFollow={ownerSocial.toggleFollowOwner}
          liveFollowCount={liveFollowCount}
          followerTotal={followerTotal}
          followTappers={followTappers}
          isCommerceLive={isCommerceLive}
          liveStartedAt={hostLiveMetrics?.startedAt ?? null}
          viewerCount={hostLiveMetrics?.currentViewers ?? viewers.length}
          viewerAvatars={viewers.map((viewer) => ({ id: viewer.id, avatar: viewer.avatar }))}
          pkTimerLabel={pkTimerLabel}
          onOpenHostDashboard={onOpenHostDashboard}
          onViewers={() => setIsRoomViewersOpen(true)}
          onShare={onShareRoom}
          onHourlyTop={onOpenArenaRankings}
          onDailyGift={() => setDailyGiftOpen(true)}
          onMyGifts={() =>
            onOpenGiftSenders({
              name: hostGuest?.name ?? ownerSocial.ownerIdentity.name,
              userId: hostGuest?.userId ?? ownerSocial.ownerViewerPayload.id,
            })
          }
          flashSaleProduct={isCommerceLive ? liveFeaturedProduct : null}
          flashSaleSalesCount={commerceSalesCount}
          onFlashSale={
            isCommerceLive && liveFeaturedProduct
              ? isSelfHost
                ? onToggleCommerceShop
                : onCommercePurchase
                  ? () => onCommercePurchase(liveFeaturedProduct)
                  : undefined
              : undefined
          }
          onClose={hostEndLiveOnly && onRequestEndLive ? onRequestEndLive : onLeaveRoom}
          closeAriaLabel={hostEndLiveOnly && onRequestEndLive ? 'End Live' : 'Leave room'}
          onHostProfile={() =>
            handleSelectViewer(
              hostGuest
                ? buildViewerFromGuest(hostGuest, 'host')
                : ownerSocial.ownerViewerPayload,
            )
          }
        />

        {occupiedGuestSeatKeys.length > 0 ? (
        <div
          ref={guestStageRef}
          className="solo-live-guest-rail"
        >
          <div className="solo-live-guest-grid">
            {occupiedGuestSeatKeys.map((seatKey) => renderGuestSeat(seatKey))}
          </div>
          {rawVideoRef && deeparPreviewRef && isSelfGuest ? (
            <MultiGuestSelfMediaHost
              stageRef={guestStageRef}
              anchorRef={selfGuestAnchorRef}
              seatKey={userSeatKey}
              active={Boolean(isSelfGuest && userCameraOn)}
              layoutNonce={footerHeight}
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
        ) : null}

        <div className="solo-live-conversation absolute inset-x-0 bottom-0 z-30 flex max-h-[46%] min-h-0 flex-col overflow-visible">
          {chatComposerOpen ? (
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
                          bubbleClassName: 'bg-transparent border-0 shadow-none',
                        },
                      ),
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          ) : null}

          <div
            id="solo-live-footer"
            ref={footerRef}
            className="solo-live-footer relative z-50 shrink-0"
          >
            {chatComposerOpen ? (
            <SoloShopLiveComposerActions
              open
              onOpenStickers={onOpenStickers}
              cameraOn={userCameraOn}
              cameraEnabled={isSelfSeated}
              onToggleCamera={onToggleUserCamera}
              micOn={userMicOn}
              micEnabled={Boolean(userSeatKey)}
              onToggleMic={onToggleUserMic}
            >
              <form onSubmit={handleSendMessage} className="approved-live-chat-form">
                {mentionSearch !== null ? (
                  <div className="approved-live-mention-menu">
                    {getMentionSuggestions().length > 0 ? (
                      getMentionSuggestions().map((user, index) => (
                        <button key={`${user.name}-${index}`} type="button" onClick={() => selectMention(user.name)}>
                          <img src={safeAvatarUrl(user.avatar)} alt="" />
                          <span>{user.name}</span>
                        </button>
                      ))
                    ) : (
                      <div>No users found</div>
                    )}
                  </div>
                ) : null}
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="send"
                  autoComplete="off"
                  data-testid="live-chat-input"
                  value={chatInput}
                  onChange={(event) => handleChatInputChange(event.target.value)}
                  placeholder="Say something..."
                  aria-label="live-chat-input"
                />
              </form>
            </SoloShopLiveComposerActions>
            ) : null}

            <SoloShopLiveControls
                isCommerceLive={isCommerceLive}
                chatComposerOpen={chatComposerOpen}
                onToggleChatComposer={() => setChatComposerOpen((open) => !open)}
                onOpenGuests={() =>
                  onOpenGuestManagement ? onOpenGuestManagement() : setIsGuestManagementOpen(true)
                }
                guestsOpen={guestManagementOpen}
                onOpenPk={onPkClick}
                pkEnabled={pkEnabled}
                onOpenGift={() => setIsGiftPickerOpen(true)}
                onOpenEffects={showBeautyControls ? onToggleBeautyPanel : onToggleEffectsPanel}
                effectsOpen={showBeautyControls ? beautyPanelOpen : effectsPanelOpen}
                effectsEnabled={showBeautyControls || showDeepARControls}
                onOpenGame={onGameClick}
                onOpenShop={onToggleCommerceShop}
                shopOpen={commerceShopOpen}
                shopActive={Boolean(liveFeaturedProduct)}
                moreActions={moreActions}
                moreExtras={<RoomHeaderYoutubeMiniButton className="approved-live-more-extra" label="YouTube" />}
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
          onBeautifyParamsChange={onBeautifyParamsChange}
          beautifyOverride={beautifyOverride}
          selfName={isSelfHost ? ownerSocial.ownerIdentity.name : 'You'}
          selfAvatarUrl={isSelfHost ? ownerSocial.ownerIdentity.avatarUrl : undefined}
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

      {isCommerceLive && onToggleCommerceShop ? (
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
          onPurchase={onCommercePurchase}
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
          onMarkShipped={onCommerceMarkShipped}
        />
      ) : null}

      <SoloShopLiveDailyGiftSheet
        open={dailyGiftOpen}
        hostName={hostGuest?.name ?? ownerSocial.ownerIdentity.name}
        isHost={isSelfHost}
        giftCount={roomGiftSummary.giftCount}
        totalStars={roomGiftSummary.totalStars}
        todayExp={roomExpProgress.todayExp}
        dailyCap={roomExpProgress.dailyCap}
        giftBonusExp={roomExpProgress.todayBonusExp}
        onClose={() => setDailyGiftOpen(false)}
        onOpenGiftPanel={() => setIsGiftPickerOpen(true)}
      />

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

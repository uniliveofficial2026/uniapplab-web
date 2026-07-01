import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  X, Mic, MicOff, Users, MessageCircle, Gift, Heart, Settings, Plus, Send, 
  Crown, Shield, Menu, Pencil, ChevronRight, LayoutGrid,
  Coins, Star, Volume2, Sparkle, FolderClosed, Sofa, User, Activity, Music,
  UserPlus, UserMinus, LogOut, Eye, ShieldAlert, UserX, Lock, Unlock, Search, HelpCircle,
  Info, Settings2,
} from "lucide-react";

import { ShareIcon } from "../../components/common/ShareIcon";

import { ShareModal } from "../../components/feed/ShareModal";
import { buildPartySharePayload } from "../../lib/shareLinks";
import { nativeVideoControlGuardProps } from "../../lib/nativeVideoControls";
import { SongSelector } from "../components/SongSelector";
import { LyricsOverlay } from "../components/LyricsOverlay";
import { ChorusPerformanceStage } from "../components/ChorusPerformanceStage";
import { GuestManagementOverlay } from "../components/GuestManagementOverlay";
import { RoomViewersOverlay } from "../components/RoomViewersOverlay";
import { ArenaRankingsOverlay } from "../components/ArenaRankingsOverlay";
import { RoomArenaColumn } from "../components/RoomArenaLeaderboard";
import { RoomHeaderActionsMenu, type RoomHeaderMenuItem } from "../components/RoomHeaderActionsMenu";
import { ChatRoleBadges } from "../components/ChatRoleBadges";
import { WatchTogetherView } from "../components/WatchTogetherView";
import { RoomProfilePreviewModal } from "../components/RoomProfilePreviewModal";
import { RoomDetailsScreen } from "../pages/RoomDetails";
import { EditRoomScreen } from "../pages/EditRoom";
import { RoomOwnerSocialControls } from "../components/RoomOwnerSocialControls";
import { RoomLiveHeaderInfo } from "../components/RoomLiveHeaderInfo";
import { RoomBackgroundLayer } from "../components/RoomBackgroundLayer";
import { RoomAnnouncementEditor, getAnnouncementDraft } from "../components/RoomAnnouncementEditor";
import { RoomAnnouncementChatPin } from "../components/RoomAnnouncementChatPin";
import { buildViewerRoomWelcome } from "../utils/roomAnnouncementPersonalize";
import { RoomModeSettingsSheet } from "../components/RoomModeSettingsSheet";
import { RoomKeyGate } from "../components/RoomKeyGate";
import {
  SeatHeartbeatRowOverlay,
  type SeatHeartbeatLink,
} from "../components/SeatHeartbeatRowOverlay";
import { useRoomOwnerSocial } from "../hooks/useRoomOwnerSocial";
import { getRoomSettings, ensureRoomSettingsSeeded, saveRoomSettings, type RoomMode } from "../utils/storage";
import { resolveWatchTogetherMedia, hydrateWatchTogetherMedia } from "../utils/watchTogetherMedia";
import { activateRoomContext, clearActiveRoomSession, formatRoomModeLabel, getManagedRoomById, syncManagedRoomFromActiveSession } from "../utils/managedRooms";
import {
  isPrivateRoom,
  resolveRoomPrivacy,
  resolveRoomKey,
  roomPrivacyPatch,
  validateRoomKeyInput,
  verifyRoomKey,
} from "../utils/roomPrivacy";
import { canChangeRoomBackground as roleCanChangeRoomBackground, isRoomAdminOrOwner, isRoomCoOwner, isRoomEditorRole, isRoomOwner, normalizeRoomRole, type RoomMemberRole } from "../utils/roles";
import { isRoomSavedById, toggleSavedRoom } from "../utils/savedRooms";
import { formatRoomHostMeta, resolveRoomHostDisplay } from "../utils/roomHostDisplay";
import {
  buildRoomProfilePreview,
  resolveRoomViewerUserId,
} from "../utils/roomProfilePreview";
import { useDbRevision } from "../../lib/useDB";
import { getChorusPanelSongs, CHORUS_SONG_TABS, type ChorusSongTab } from "../utils/songCatalog";
import { isKaraokeUploadSongId } from "../utils/karaokeUploadBridge";
import { initSongLibrary } from "../utils/songLibrary";
import { seedDemoRoomMedia, syncRoomMemberAvatars, displaySettingValue } from "../utils/roomMedia";
import {
  mapSettingsModeToRoomMode,
  parseRoomBackground,
  resolveRoomLayoutFromSettings,
  ROOM_BACKGROUND_PRESETS,
  serializeRoomBackground,
  type RoomBackgroundMode,
} from "../utils/roomBackground";
import {
  canUserJoinRoom,
  canUserTakeSeat,
  formatJoinPolicySummary,
  seatJoinRequiresApproval,
  whoCanBeSeatedFromApprovalRequired,
  type RoomJoinContext,
} from "../utils/roomJoinPolicy";
import { buildSelfRoomJoinContext } from "../utils/roomFollowContext";
import {
  buildViewersFromPartyState,
  mergeViewerJoinTimestamps,
  viewerEntryFromDisplayName,
  viewerEntryFromSimulatedUser,
  type RoomViewerEntry,
} from "../utils/roomViewers";
import { resolveRoomMemberIdentity } from "../utils/roomMemberProfile";
import {
  ensureRoomRoleUserIds,
  assignRoomCoOwner,
  canEditRoomForUser,
  canTakeAdminSeat,
  clearRoomCoOwner,
  isRoomCoOwnerUser,
  resolveChatRoleFlags,
  resolveEffectiveMemberRole,
  resolveMemberRoleForUser,
  resolveOwnerDisplayName,
  resolveOwnerUserId,
  type ChatRoleFlags,
} from "../utils/roomRoleUsers";
import { db } from "../../lib/db/localDb";
import {
  FREE_EXP_PER_SECOND,
  getRoomExpProgress,
  grantRoomExp,
  goldExpFromGiftStars,
  initRoomExp,
  type RoomExpProgress,
} from "../utils/roomExp";
import {
  getReceiverGiftStars,
  getRoomGiftSummary,
  initRoomGifts,
  PARTY_GIFT_CATALOG,
  recordRoomGift,
  syncSeatsReceiverStars,
  type PartyGiftDefinition,
  type RoomGiftSummary,
} from "../utils/roomGifts";
import { useRoomSelf } from "../context/RoomSelfContext";
import { useRoomFlowExit } from "../context/RoomFlowContext";
import {
  formatRoomSelfLabel,
  isRoomSelfGuest,
  isRoomSelfName,
} from "../utils/selfIdentity";
import { formatRoomChatUserLabel } from "../utils/roomChatLabels";
import {
  createEmptyPartySeats,
  createGuestFromRequest,
  createGuestFromSelf,
  clearSelfFromPartySeats,
  hydratePartySeatsWithStars,
  savePartySeats,
  formatSeatActionSubtitle,
  formatStaffSeatLabel,
  isPartyStaffSeatKey,
  formatGuestSeatNumber,
  splitPartyGuestSeatRows,
  splitChorusGuestSeatRows,
  ALL_SEAT_KEYS,
  resolveSeatGuestDisplay,
  type PartySeatMap,
  type RoomGuest,
  type SeatGuestRequest,
} from "../utils/roomSeats";
import { SeatSpeakingLevelBars, SeatVoiceGlowEffect } from "../components/SeatVoiceVisuals";
import { useMicVoiceActivity } from "../hooks/useMicVoiceActivity";
import { useSongPerformanceTimer } from "../hooks/useSongPerformanceTimer";
import { useSingingSession } from "../hooks/useSingingSession";
import { usePerformanceBackingTrack } from "../hooks/usePerformanceBackingTrack";
import { useUploadSongPlayback } from "../hooks/useUploadSongPlayback";
import { safeAvatarUrl } from "../../lib/safe";
import { getActiveLyricIndex, resolveActiveSong, DEFAULT_TRACK_DURATION_SEC, type ActiveSong } from "../utils/songPerformance";
import type { VoiceChangerEffectId } from "../utils/voiceEffects";

interface Guest extends RoomGuest {}

interface QueuedSong {
  id: string;
  title: string;
  artist: string;
  requestedBy: string;
  requestedByUserId?: string;
  image?: string;
}

/** smule-clone bump in local coords (one gap between two seats) */
const PARTY_HEARTBEAT_ROW1: SeatHeartbeatLink[] = [
  { left: "no1", right: "no2", relKey: "no1-no2", color: "#f43f5e", glowColor: "rgba(244,63,94,0.7)" },
  { left: "no2", right: "no3", relKey: "no2-no3", color: "#a855f7", glowColor: "rgba(168,85,247,0.7)" },
  { left: "no3", right: "no4", relKey: "no3-no4", color: "#f43f5e", glowColor: "rgba(244,63,94,0.7)" },
];

const PARTY_HEARTBEAT_ROW2: SeatHeartbeatLink[] = [
  { left: "no5", right: "no6", relKey: "no5-no6", color: "#f43f5e", glowColor: "rgba(244,63,94,0.7)" },
  { left: "no6", right: "no7", relKey: "no6-no7", color: "#a855f7", glowColor: "rgba(168,85,247,0.7)" },
  { left: "no7", right: "no8", relKey: "no7-no8", color: "#f43f5e", glowColor: "rgba(244,63,94,0.7)" },
];

export function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const self = useRoomSelf();
  const dbRevision = useDbRevision();
  const exitRoomFlow = useRoomFlowExit();
  const roomDisplayId = id ?? "1181033";
  const [liveSettings, setLiveSettings] = useState(() =>
    ensureRoomRoleUserIds(roomDisplayId),
  );
  const roomTitle =
    liveSettings.roomName?.trim() ||
    "BRASIL";

  const roomAnnouncement = useMemo(
    () => getAnnouncementDraft(liveSettings),
    [liveSettings.bulletin, liveSettings.greetings],
  );

  const selfRoomWelcome = useMemo(
    () => buildViewerRoomWelcome(liveSettings, self.roomName),
    [liveSettings.bulletin, liveSettings.greetings, self.roomName],
  );

  const partySharePayload = useMemo(
    () => buildPartySharePayload(roomDisplayId, roomTitle),
    [roomDisplayId, roomTitle],
  );

  const watchTogetherMedia = useMemo(
    () => resolveWatchTogetherMedia(liveSettings, roomDisplayId),
    [liveSettings, roomDisplayId],
  );

  const refreshLiveSettings = useCallback(() => {
    setLiveSettings(ensureRoomRoleUserIds(roomDisplayId));
  }, [roomDisplayId]);

  useEffect(() => {
    refreshLiveSettings();
  }, [refreshLiveSettings]);

  useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string }>).detail;
      if (!detail?.roomId || detail.roomId === roomDisplayId) {
        refreshLiveSettings();
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key.includes(roomDisplayId) || event.key === 'roomSettings') {
        refreshLiveSettings();
      }
    };

    window.addEventListener('room-settings-updated', onSettingsUpdated);
    window.addEventListener('storage', onStorage);
    const onWatchTogetherMediaUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string }>).detail;
      if (!detail?.roomId || detail.roomId === roomDisplayId) {
        refreshLiveSettings();
      }
    };
    window.addEventListener('watch-together-media-updated', onWatchTogetherMediaUpdated);
    return () => {
      window.removeEventListener('room-settings-updated', onSettingsUpdated);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('watch-together-media-updated', onWatchTogetherMediaUpdated);
    };
  }, [roomDisplayId, refreshLiveSettings]);
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [isRoomSaved, setIsRoomSaved] = useState(() => isRoomSavedById(roomDisplayId));

  const handleCopyRoomId = (event: React.MouseEvent) => {
    event.stopPropagation();
    void navigator.clipboard.writeText(roomDisplayId).then(() => {
      setRoomIdCopied(true);
      window.setTimeout(() => setRoomIdCopied(false), 2000);
    });
  };

  useEffect(() => {
    setIsRoomSaved(isRoomSavedById(roomDisplayId));
  }, [roomDisplayId]);

  useEffect(() => {
    const handleSavedRoomsUpdated = () => {
      setIsRoomSaved(isRoomSavedById(roomDisplayId));
    };
    window.addEventListener('saved-rooms-updated', handleSavedRoomsUpdated);
    return () => window.removeEventListener('saved-rooms-updated', handleSavedRoomsUpdated);
  }, [roomDisplayId]);

  // Interactive View control: allows instantly switching between Screenshot 1 and Screenshot 2
  const [isFullPartyMode, setIsFullPartyMode] = useState<boolean>(() =>
    resolveRoomLayoutFromSettings(ensureRoomSettingsSeeded(roomDisplayId).roomMode).isFullPartyMode,
  );
  const [roomMode, setRoomMode] = useState<'Party' | 'Chorus' | 'WatchTogether'>(() =>
    resolveRoomLayoutFromSettings(ensureRoomSettingsSeeded(roomDisplayId).roomMode).layout,
  );
  const roomLayoutConfig = useMemo(
    () => resolveRoomLayoutFromSettings(liveSettings.roomMode),
    [liveSettings.roomMode],
  );
  const partyGuestSeatRows = useMemo(
    () => splitPartyGuestSeatRows(roomLayoutConfig.guestSeatKeys),
    [roomLayoutConfig.guestSeatKeys],
  );
  const chorusSeatRows = useMemo(
    () => splitChorusGuestSeatRows(roomLayoutConfig.guestSeatKeys),
    [roomLayoutConfig.guestSeatKeys],
  );
  const usesLivePartyFeed = isFullPartyMode || roomMode === 'WatchTogether';
  
  // Custom states
  const [customGreeting, setCustomGreeting] = useState("Show your enthusiasm");
  const [isEditingGreeting, setIsEditingGreeting] = useState(false);
  const [newGreetingInput, setNewGreetingInput] = useState("Show your enthusiasm");
  
  const [likes, setLikes] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [chatInput, setChatInput] = useState("");
  
  // Dynamic audio frequency simulation for active speaking wave animation
  const [audioPulse, setAudioPulse] = useState(0);
  
  // Real-time interactive states
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const CHAT_SCROLL_BOTTOM_THRESHOLD = 72;
  const isAutoScrollEnabled = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const announcedJoinUserIdsRef = useRef<Set<string>>(new Set());
  const announceUserJoinedRoomRef = useRef<
    (userId: string, displayName: string, options?: { allowRepeat?: boolean }) => void
  >(() => {});
  const [roomExpProgress, setRoomExpProgress] = useState<RoomExpProgress>(() =>
    getRoomExpProgress(roomDisplayId),
  );
  const [roomGiftSummary, setRoomGiftSummary] = useState<RoomGiftSummary>(() =>
    getRoomGiftSummary(roomDisplayId),
  );
  const [isGiftPickerOpen, setIsGiftPickerOpen] = useState(false);
  const activeSeatsRef = useRef<PartySeatMap>({} as PartySeatMap);
  const applyRoomGiftRef = useRef<
    ((
      input: {
        senderName: string;
        receiverName: string;
        receiverUserId?: string;
        giftName: string;
        giftIcon: string;
        starValue: number;
      },
      options?: { creditSeat?: boolean; showChat?: boolean },
    ) => { starValue: number }) | null
  >(null);
  const [arenaParticipants, setArenaParticipants] = useState([
    { id: "p1", name: "Melodia 🎙️", nick: "Auc kakibos...", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120", score: 1059 },
    { id: "p2", name: "old country 🎸", nick: "old country...", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120", score: 330 },
    { id: "p3", name: "Chou 🎵", nick: "Chou...", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120", score: 21 }
  ]);
  const leaderScores = arenaParticipants.map(p => p.score);
  const [isArenaRankingsOpen, setIsArenaRankingsOpen] = useState(false);
  const [isAnnouncementEditorOpen, setIsAnnouncementEditorOpen] = useState(false);
  const [isRoomModePickerOpen, setIsRoomModePickerOpen] = useState(false);
  const [hasPrivateKeyAccess, setHasPrivateKeyAccess] = useState(() => {
    const settings = ensureRoomRoleUserIds(roomDisplayId);
    return !isPrivateRoom(settings);
  });
  const [countdown, setCountdown] = useState(345475); // Starting total seconds
  const [liveChatMsgs, setLiveChatMsgs] = useState<any[]>([]);
  
  const [guestRequests, setGuestRequests] = useState<SeatGuestRequest[]>([]);

  const handleDeclineRequest = (reqId: string) => {
    setGuestRequests(prev => prev.filter(r => r.id !== reqId));
  };

  const handleSendSupport = (participantId: string, giftName: string, giftIcon: string, amount: number) => {
    setArenaParticipants(prev => {
      const updated = prev.map(p => {
        if (p.id === participantId) {
          return { ...p, score: p.score + amount };
        }
        return p;
      });
      return [...updated].sort((a, b) => b.score - a.score);
    });

    // Find recipient details
    const targetParticipant = arenaParticipants.find(p => p.id === participantId);
    const receiverName = targetParticipant ? targetParticipant.name : "Candidate";

    setLiveChatMsgs(prev => [
      ...prev,
      {
        id: Date.now(),
        user: self.chatLabel,
        userId: self.id,
        isGiftEvent: true,
        giftName,
        giftIcon,
        giftAmount: amount,
        receiver: receiverName,
        text: `Sent ${giftName} ${giftIcon} to ${receiverName}`
      }
    ].slice(-15));

    const starValue = Math.max(1, Math.floor(amount / 5));
    applyRoomGiftRef.current?.(
      {
        senderName: self.roomName,
        receiverName,
        giftName,
        giftIcon,
        starValue,
      },
      { showChat: false },
    );
    showToast(`Successfully supported ${receiverName} with ${giftName} ${giftIcon}! (+${amount} Arena Score)`);
  };

  const scrollChatToBottom = useCallback((options?: { force?: boolean }) => {
    const { force = false } = options ?? {};
    if (!force && !isAutoScrollEnabled.current) return;

    const pin = () => {
      const container = chatScrollRef.current;
      if (!container) return;
      isProgrammaticScrollRef.current = true;
      const nextTop = Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollTop = nextTop;
    };

    pin();
    requestAnimationFrame(() => {
      pin();
      requestAnimationFrame(pin);
    });

    window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 80);
  }, []);

  const handleChatScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const container = chatScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isAutoScrollEnabled.current = distanceFromBottom <= CHAT_SCROLL_BOTTOM_THRESHOLD;
  }, []);

  // Stick to bottom when new live messages arrive (unless user scrolled up)
  useLayoutEffect(() => {
    scrollChatToBottom();
  }, [liveChatMsgs, scrollChatToBottom]);

  // Start pinned to latest on first paint / mode switch
  useLayoutEffect(() => {
    isAutoScrollEnabled.current = true;
    scrollChatToBottom({ force: true });
  }, [isFullPartyMode, roomMode, scrollChatToBottom]);

  // Re-scroll when message list height changes (sing cards, gifts, badges)
  useEffect(() => {
    const container = chatScrollRef.current;
    const list = chatMessagesRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      scrollChatToBottom();
    });

    observer.observe(container);
    if (list) observer.observe(list);

    return () => observer.disconnect();
  }, [scrollChatToBottom, isFullPartyMode, roomMode]);

  useEffect(() => {
    initRoomExp(roomDisplayId);
    initRoomGifts(roomDisplayId);
    initSongLibrary();
    setRoomExpProgress(getRoomExpProgress(roomDisplayId));
    setRoomGiftSummary(getRoomGiftSummary(roomDisplayId));
    setActiveSeats((prev) => syncSeatsReceiverStars(prev, roomDisplayId) as PartySeatMap);
  }, [roomDisplayId]);

  useEffect(() => {
    const refreshExp = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string }>).detail;
      if (!detail?.roomId || detail.roomId === roomDisplayId) {
        setRoomExpProgress(getRoomExpProgress(roomDisplayId));
      }
    };
    const refreshGifts = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string }>).detail;
      // Seat stars are global per receiver, so always resync active seats.
      setActiveSeats((prev) => syncSeatsReceiverStars(prev, roomDisplayId) as PartySeatMap);
      if (!detail?.roomId || detail.roomId === roomDisplayId) {
        setRoomGiftSummary(getRoomGiftSummary(roomDisplayId));
      }
    };
    window.addEventListener('room-exp-updated', refreshExp);
    window.addEventListener('room-gifts-updated', refreshGifts);
    return () => {
      window.removeEventListener('room-exp-updated', refreshExp);
      window.removeEventListener('room-gifts-updated', refreshGifts);
    };
  }, [roomDisplayId]);

  useEffect(() => {
    const metricInterval = setInterval(() => {
      setAudioPulse(Math.floor(Math.random() * 100));
      if (usesLivePartyFeed) {
        const hasSeatedGuests = Object.values(activeSeatsRef.current).some((guest) => guest !== null);
        const freeSource = hasSeatedGuests ? 'free-seated' : 'free-empty';
        const { granted, progress } = grantRoomExp(
          roomDisplayId,
          FREE_EXP_PER_SECOND,
          freeSource,
        );
        if (granted > 0) {
          setRoomExpProgress(progress);
        }
      }
      setArenaParticipants(prev => {
        const next = prev.map(p => ({
          ...p,
          score: p.score + Math.floor(Math.random() * 2)
        }));
        return [...next].sort((a, b) => b.score - a.score);
      });
      setCountdown(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    
    const chatSource = ["amazing! 🔥", "sing it bestie", "hello room", "can you hear me?", "welcome...", "nice voice!", "lets gooo"];
    const ownerUserId = resolveOwnerUserId(liveSettings) ?? undefined;
    const usersSource = [
      { name: "Mildred" },
      { name: "Guest_991" },
      { name: "Alex" },
      { name: "captain ghe" },
      { name: "VIP_Sanny", userId: ownerUserId },
      { name: "MR Nikk" },
    ];
    
    const chatInterval = setInterval(() => {
      const rand = Math.random();
      if (rand > 0.5) {
        // A simulated user speaks
        const user = usersSource[Math.floor(Math.random() * usersSource.length)];
        const simUserId =
          user.userId ??
          `sim-${user.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
        setLiveChatMsgs(prev => [
          ...prev, 
          {
            id: Date.now(),
            user: user.name,
            userId: simUserId,
            text: chatSource[Math.floor(Math.random() * chatSource.length)]
          }
        ].slice(-15)); // Keep only latest 15 messages so DOM doesn't bloat

        // Move/Add user to top of viewers list with current timestamp
        setViewers((prev) => {
          const entry = viewerEntryFromSimulatedUser(liveSettings, roomDisplayId, self.id, user);
          const filtered = prev.filter(
            (viewer) => viewer.id !== entry.id && viewer.name !== entry.name,
          );
          return [{ ...entry, joinedAt: Date.now() }, ...filtered];
        });
      } else if (rand > 0.42 && rand <= 0.52 && usesLivePartyFeed) {
        const gift = PARTY_GIFT_CATALOG[Math.floor(Math.random() * PARTY_GIFT_CATALOG.length)];
        const sender = usersSource[Math.floor(Math.random() * usersSource.length)];
        const seated = Object.entries(activeSeatsRef.current).filter(
          (entry): entry is [string, Guest] => entry[1] !== null,
        );
        if (seated.length > 0) {
          const [, receiver] = seated[Math.floor(Math.random() * seated.length)];
          applyRoomGiftRef.current?.({
            senderName: sender.name,
            receiverName: receiver.name,
            giftName: gift.name,
            giftIcon: gift.icon,
            starValue: gift.stars,
          });
        }
      } else if (rand > 0.25) {
        const coolNames = [
          "shining_star⭐", "panda_cute🐼", "ruby_player💎", "golden_voice🎤", 
          "rose_petal🌸", "blue_ocean🌊", "chill_zone🧘", "shadow_dancer💃",
          "cyber_hero🤖", "mystic_dreamer🔮", "retro_wave🌈", "neon_rider🏍️",
          "Burmese_Boy🇲🇲", "Ruby_Queen👑", "Lucky_Spells✨", "Midnight_Melody🎵"
        ];
        const newName = coolNames[Math.floor(Math.random() * coolNames.length)] + "_" + Math.floor(Math.random() * 900 + 100);
        const joinEntry = viewerEntryFromDisplayName(liveSettings, roomDisplayId, self.id, newName);
        announceUserJoinedRoomRef.current(joinEntry.id, joinEntry.name, { allowRepeat: true });
        setViewers((prev) => {
          const entry = viewerEntryFromDisplayName(liveSettings, roomDisplayId, self.id, newName);
          return [entry, ...prev.filter((viewer) => viewer.name !== newName)];
        });
      }
    }, 2800);
    
    return () => {
      clearInterval(metricInterval);
      clearInterval(chatInterval);
    };
  }, [usesLivePartyFeed, roomDisplayId, liveSettings, self.id]);

  const formatCountdown = (secs: number) => {
    const d = Math.floor(secs / (3600*24));
    const h = Math.floor(secs % (3600*24) / 3600).toString().padStart(2, '0');
    const m = Math.floor(secs % 3600 / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${d}days,${h}:${m}:${s}`;
  };

  const [isSongSelectorOpen, setIsSongSelectorOpen] = useState(false);
  const [currentlySinging, setCurrentlySinging] = useState<ActiveSong | null>(null);
  const [isSingingMode, setIsSingingMode] = useState(false);
  const [songQueue, setSongQueue] = useState<QueuedSong[]>([]);
  const [currentSingerName, setCurrentSingerName] = useState<string | null>(null);
  const [chorusScore, setChorusScore] = useState(0);
  const sentenceBestScoresRef = useRef<Record<number, number>>({});
  const sentenceRunningScoresRef = useRef<Record<number, number>>({});
  const activeSentenceRef = useRef<number>(0);
  const finishCurrentSongRef = useRef<() => void>(() => {});
  const cancelCurrentSongRef = useRef<() => void>(() => {});
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isLyricsOverlayOpen, setIsLyricsOverlayOpen] = useState(false);
  const [singingVoiceEffect, setSingingVoiceEffect] = useState<VoiceChangerEffectId>('studio');
  const [isGuestManagementOpen, setIsGuestManagementOpen] = useState(false);
  const [isRoomViewersOpen, setIsRoomViewersOpen] = useState(false);
  const [isShareRoomOpen, setIsShareRoomOpen] = useState(false);
  const [isQueueSheetOpen, setIsQueueSheetOpen] = useState(false);
  const [chorusSongTab, setChorusSongTab] = useState<ChorusSongTab>('recommended');
  const [chorusSongSearch, setChorusSongSearch] = useState('');
  const [karaokeUploadsVersion, setKaraokeUploadsVersion] = useState(0);
  const [selectedSeatAction, setSelectedSeatAction] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<RoomMemberRole>(() =>
    normalizeRoomRole(localStorage.getItem('currentUserRole') || 'user')
  );

  useEffect(() => {
    const refreshUploads = () => setKaraokeUploadsVersion((version) => version + 1);
    window.addEventListener('karaoke-uploads-updated', refreshUploads);
    return () => window.removeEventListener('karaoke-uploads-updated', refreshUploads);
  }, []);

  useEffect(() => {
    localStorage.setItem('activeRoomId', roomDisplayId);
    const settings = ensureRoomRoleUserIds(roomDisplayId);
    setLiveSettings(settings);
    const managed = getManagedRoomById(roomDisplayId);
    if (managed) {
      activateRoomContext(managed);
    }
    setCurrentUserRole(
      resolveEffectiveMemberRole(settings, self.id, {
        sessionRole: managed?.role ?? null,
        sessionUserId: self.id,
      }),
    );
  }, [roomDisplayId, self.id]);

  useEffect(() => {
    localStorage.setItem('currentUserRole', currentUserRole);
    const managed = getManagedRoomById(roomDisplayId);
    if (managed && managed.role !== currentUserRole) {
      return;
    }
    if (
      currentUserRole === 'owner' ||
      currentUserRole === 'co-owner' ||
      currentUserRole === 'admin'
    ) {
      const settings = liveSettings;
      syncManagedRoomFromActiveSession(roomDisplayId, currentUserRole, {
        name: settings.roomName,
        roomMode: settings.roomMode as 'Chat' | 'Radio' | 'Karaoke' | 'Multi-Guest',
      });
    }
  }, [currentUserRole, roomDisplayId, liveSettings]);

  // Room Management Rules
  const [lockedSeats, setLockedSeats] = useState<Record<string, boolean>>({});
  const joinWithoutRequest = !seatJoinRequiresApproval(liveSettings.whoCanBeSeated);
  const joinPolicySummary = formatJoinPolicySummary(liveSettings);
  const roomIsPrivate = isPrivateRoom(liveSettings);

  useEffect(() => {
    const settings = ensureRoomRoleUserIds(roomDisplayId);
    setHasPrivateKeyAccess(!isPrivateRoom(settings));
  }, [roomDisplayId]);

  useEffect(() => {
    if (!roomIsPrivate) {
      setHasPrivateKeyAccess(true);
    }
  }, [roomIsPrivate]);

  const handleToggleJoinMode = () => {
    const currentlyFree = !seatJoinRequiresApproval(liveSettings.whoCanBeSeated);
    const nextWhoCanBeSeated = currentlyFree
      ? whoCanBeSeatedFromApprovalRequired(true)
      : 'Anyone';
    saveRoomSettings(roomDisplayId, { whoCanBeSeated: nextWhoCanBeSeated });
    showToast(
      nextWhoCanBeSeated === 'Anyone'
        ? 'Join policy updated: Anyone can join freely!'
        : 'Join policy updated: Approval required to sit!',
    );
  };

  const handleToggleSeatLock = (seatKey: string) => {
    setLockedSeats(prev => {
      const isLocked = !prev[seatKey];
      const sNum = seatKey.replace("no", "");
      if (isLocked) {
        showToast(`Seat ${sNum} has been LOCKED successfully!`);
        // Kick occupant if any
        setActiveSeats(curr => ({ ...curr, [seatKey]: null }));
      } else {
        showToast(`Seat ${sNum} has been UNLOCKED successfully!`);
      }
      return { ...prev, [seatKey]: isLocked };
    });
  };

  // Mention State & Logic
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);

  const renderMessageTextWithMentions = (text: string) => {
    if (!text) return "";
    const words = text.split(" ");
    return (
      <span className="break-words">
        {words.map((word, i) => {
          if (word.startsWith("@") && word.length > 1) {
            return (
              <span 
                key={i} 
                onClick={() => {
                  const cleanName = word.replace("@", "");
                  // Populating it inside the chat input when clicking a highlighted mention inside chat feed
                  setChatInput(prev => {
                    if (prev.endsWith(" ") || prev === "") {
                      return `${prev}@${cleanName} `;
                    }
                    return `${prev} @${cleanName} `;
                  });
                  showToast(`Tapped to mention @${cleanName}`);
                }}
                className="text-[#FF3B70] font-black cursor-pointer hover:underline mr-1 bg-pink-500/15 px-1.5 py-0.5 rounded-md inline-block animate-pulse-slow active:scale-95 transition-transform"
              >
                {word}
              </span>
            );
          }
          return <span key={i} className="mr-1">{word}</span>;
        })}
      </span>
    );
  };

  const selectMention = (name: string) => {
    const lastAtIdx = chatInput.lastIndexOf("@");
    if (lastAtIdx !== -1) {
      const beforePart = chatInput.substring(0, lastAtIdx);
      setChatInput(`${beforePart}@${name} `);
    } else {
      setChatInput(prev => `${prev}@${name} `);
    }
    setMentionSearch(null);
  };

  const getMentionSuggestions = () => {
    const list: { name: string; avatar: string; joinedAt?: number }[] = [];

    for (const seatKey of ALL_SEAT_KEYS) {
      const guest = activeSeats[seatKey];
      if (!guest || isRoomSelfGuest(guest, self)) continue;
      const identity = resolveRoomMemberIdentity(guest.userId, guest.name, roomDisplayId, 80);
      list.push({
        name: identity.name,
        avatar: identity.avatarUrl,
        joinedAt: viewers.find((entry) => entry.id === (identity.userId ?? guest.userId))?.joinedAt ?? 0,
      });
    }

    viewers.forEach((viewer) => {
      if (viewer.id === self.id) return;
      if (list.some((item) => item.name === viewer.name || item.name === viewer.id)) return;
      list.push({
        name: viewer.name,
        avatar: viewer.avatar,
        joinedAt: viewer.joinedAt ?? 0,
      });
    });

    list.sort((a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0));

    if (mentionSearch === null) return [];
    if (mentionSearch === "") return list;
    return list.filter((item) => item.name.toLowerCase().includes(mentionSearch.toLowerCase()));
  };

  const handleChatInputChange = (val: string) => {
    setChatInput(val);
    const lastAtIdx = val.lastIndexOf("@");
    if (lastAtIdx !== -1 && lastAtIdx === val.length - 1) {
      setMentionSearch("");
    } else if (lastAtIdx !== -1 && lastAtIdx < val.length) {
      const searchStr = val.substring(lastAtIdx + 1);
      if (!searchStr.includes(" ")) {
        setMentionSearch(searchStr);
      } else {
        setMentionSearch(null);
      }
    } else {
      setMentionSearch(null);
    }
  };

  // State to manage individual seat occupancy so users can sit down or clear custom seats
  const [activeSeats, setActiveSeats] = useState<PartySeatMap>(() =>
    hydratePartySeatsWithStars(roomDisplayId, liveSettings),
  );
  useEffect(() => {
    activeSeatsRef.current = activeSeats;
  }, [activeSeats]);

  const defaultGiftReceiver = useCallback((): Guest | null => {
    if (activeSeats.host) return activeSeats.host;
    const seated = Object.values(activeSeats).find((guest): guest is Guest => guest !== null);
    return seated ?? null;
  }, [activeSeats]);

  const applyRoomGift = useCallback(
    (
      input: {
        senderName: string;
        receiverName: string;
        receiverUserId?: string;
        giftName: string;
        giftIcon: string;
        starValue: number;
      },
      options?: { creditSeat?: boolean; showChat?: boolean },
    ) => {
      const { summary, event, receiverStarsTotal } = recordRoomGift(roomDisplayId, input);
      setRoomGiftSummary(summary);

      if (options?.showChat !== false) {
        setLiveChatMsgs((prev) =>
          [
            ...prev,
            {
              id: Date.now(),
              user: input.senderName,
              userId: self.id,
              isGiftEvent: true,
              giftName: input.giftName,
              giftIcon: input.giftIcon,
              giftAmount: event.starValue,
              receiver: input.receiverName,
              text: `Sent ${input.giftName} ${input.giftIcon} to ${input.receiverName}`,
            },
          ].slice(-15),
        );
      }

      if (options?.creditSeat !== false) {
        setActiveSeats((prev) => {
          const match = Object.entries(prev).find(([, guest]) => {
            if (!guest) return false;
            if (input.receiverUserId && guest.userId === input.receiverUserId) return true;
            return guest.name === input.receiverName;
          });
          if (!match) return prev;
          const [seatKey, guest] = match;
          if (!guest) return prev;
          return {
            ...prev,
            [seatKey]: { ...guest, stars: receiverStarsTotal },
          };
        });
      }

      const { progress } = grantRoomExp(
        roomDisplayId,
        goldExpFromGiftStars(event.starValue),
        'gold',
      );
      setRoomExpProgress(progress);
      return event;
    },
    [roomDisplayId],
  );

  useEffect(() => {
    applyRoomGiftRef.current = applyRoomGift;
  }, [applyRoomGift]);

  const handleSendPartyGift = useCallback(
    (gift: PartyGiftDefinition, receiver?: Guest | null) => {
      const target = receiver ?? defaultGiftReceiver();
      if (!target) {
        showToast('No seated guest to receive a gift right now');
        return;
      }
      applyRoomGift({
        senderName: self.roomName,
        receiverName: target.name,
        receiverUserId: target.userId,
        giftName: gift.name,
        giftIcon: gift.icon,
        starValue: gift.stars,
      });
      setIsGiftPickerOpen(false);
      showToast(`Sent ${gift.icon} ${gift.name} to ${target.name} (+${gift.stars} ⭐)`);
    },
    [applyRoomGift, defaultGiftReceiver],
  );

  const selfCanTakeAdminSeat = canTakeAdminSeat(liveSettings, self.id, {
    sessionRole: currentUserRole,
    sessionUserId: self.id,
  });

  const isUserSeated =
    Object.values(activeSeats).some(
      (guest: Guest | null) => guest !== null && isRoomSelfGuest(guest, self),
    ) ||
    (isRoomOwner(currentUserRole) && Boolean(activeSeats.host)) ||
    (isRoomCoOwner(currentUserRole) && Boolean(activeSeats.coowner)) ||
    (selfCanTakeAdminSeat && Boolean(activeSeats.admin));
  const userSeatKey =
    Object.entries(activeSeats).find(([, guest]) => guest && isRoomSelfGuest(guest, self))?.[0] ??
    (isRoomOwner(currentUserRole) && activeSeats.host ? 'host' : null) ??
    (isRoomCoOwner(currentUserRole) && activeSeats.coowner ? 'coowner' : null) ??
    (selfCanTakeAdminSeat && activeSeats.admin ? 'admin' : null);
  const userMicOn = userSeatKey ? Boolean(activeSeats[userSeatKey]?.isSpeaking) : false;
  const userMicAdminMuted = userSeatKey ? Boolean(activeSeats[userSeatKey]?.isAdminMuted) : false;
  const { isVoiceActive: userVoiceActive, audioLevel: userMicLevel } = useMicVoiceActivity(
    Boolean(userSeatKey && userMicOn && !userMicAdminMuted),
  );

  const performanceKey = isSingingMode && currentlySinging ? currentlySinging.id : null;
  const isUploadPerformance = Boolean(performanceKey && isKaraokeUploadSongId(performanceKey));
  const catalogPerformanceTimer = useSongPerformanceTimer(
    Boolean(performanceKey) && !isUploadPerformance,
    currentlySinging?.durationSec ?? DEFAULT_TRACK_DURATION_SEC,
    isUploadPerformance ? null : performanceKey,
    () => {
      finishCurrentSongRef.current();
    },
  );
  const uploadPerformancePlayback = useUploadSongPlayback({
    active: isUploadPerformance,
    playing: Boolean(performanceKey) && isSingingMode,
    songKey: isUploadPerformance ? performanceKey : null,
    onComplete: () => {
      finishCurrentSongRef.current();
    },
  });
  const performanceElapsedSec = isUploadPerformance
    ? uploadPerformancePlayback.elapsedSec
    : catalogPerformanceTimer.elapsedSec;
  const chorusProgressPercent = isUploadPerformance
    ? uploadPerformancePlayback.progressPercent
    : catalogPerformanceTimer.progressPercent;
  const chorusElapsedLabel = isUploadPerformance
    ? uploadPerformancePlayback.elapsedLabel
    : catalogPerformanceTimer.elapsedLabel;
  const chorusTotalLabel = isUploadPerformance
    ? uploadPerformancePlayback.totalLabel
    : catalogPerformanceTimer.totalLabel;
  const performanceDurationSec = isUploadPerformance
    ? uploadPerformancePlayback.durationSec || currentlySinging?.durationSec || DEFAULT_TRACK_DURATION_SEC
    : currentlySinging?.durationSec ?? DEFAULT_TRACK_DURATION_SEC;

  const isSelfPerforming = isSingingMode && currentSingerName === self.roomName;
  const performanceLyricIndex = getActiveLyricIndex(
    performanceElapsedSec,
    performanceDurationSec,
    currentlySinging?.lyrics?.length ?? 1,
    currentlySinging?.lyricStartTimes,
  );
  usePerformanceBackingTrack(Boolean(performanceKey) && !isUploadPerformance, performanceLyricIndex);
  const {
    micLevel: singingMicLevel,
    isVoiceActive: singingVoiceActive,
    voiceStatus: singingVoiceStatus,
  } = useSingingSession(isSelfPerforming, singingVoiceEffect);

  const handleToggleSaveRoom = (event: React.MouseEvent) => {
    event.stopPropagation();
    const nextSaved = toggleSavedRoom({
      id: roomDisplayId,
      name: roomTitle,
      hostName: formatRoomHostMeta(
        resolveRoomHostDisplay(roomDisplayId, activeSeats.host?.name),
      ),
      level: roomExpProgress.level,
    });
    setIsRoomSaved(nextSaved);
  };

  const [isPKActive, setIsPKActive] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<RoomBackgroundMode>(() =>
    parseRoomBackground(ensureRoomSettingsSeeded(roomDisplayId).background),
  );
  const [pendingBackgroundMode, setPendingBackgroundMode] = useState<RoomBackgroundMode | null>(null);
  const [isRoomBackgroundMenuOpen, setIsRoomBackgroundMenuOpen] = useState(false);

  const canChangeRoomBackground = roleCanChangeRoomBackground(currentUserRole);

  const canManageRoomKey = isRoomOwner(currentUserRole);

  const sessionRole = getManagedRoomById(roomDisplayId)?.role ?? currentUserRole;

  const canEditRoomAnnouncement = useMemo(
    () =>
      canEditRoomForUser(liveSettings, self.id, {
        sessionRole,
      }),
    [liveSettings, self.id, sessionRole],
  );

  const handleOpenAnnouncementEditor = useCallback(() => {
    if (!canEditRoomAnnouncement) return;
    setIsAnnouncementEditorOpen(true);
  }, [canEditRoomAnnouncement]);

  const handleOpenRoomModePicker = useCallback(() => {
    if (!canEditRoomAnnouncement) return;
    setIsRoomModePickerOpen(true);
  }, [canEditRoomAnnouncement]);

  const [roomSettingsOverlay, setRoomSettingsOverlay] = useState<
    null | { view: 'details' | 'edit'; editFrom: 'header' | 'details' }
  >(null);

  const closeRoomSettingsOverlay = useCallback(() => {
    setRoomSettingsOverlay(null);
  }, []);

  const openRoomDetails = useCallback(() => {
    setRoomSettingsOverlay({ view: 'details', editFrom: 'header' });
  }, []);

  const openRoomEdit = useCallback(() => {
    if (!canEditRoomAnnouncement) return;
    setRoomSettingsOverlay({ view: 'edit', editFrom: 'header' });
  }, [canEditRoomAnnouncement]);

  const openRoomEditFromDetails = useCallback(() => {
    if (!canEditRoomAnnouncement) return;
    setRoomSettingsOverlay({ view: 'edit', editFrom: 'details' });
  }, [canEditRoomAnnouncement]);

  const handleRoomSettingsOverlayBack = useCallback(() => {
    setRoomSettingsOverlay((current) => {
      if (current?.view === 'edit' && current.editFrom === 'details') {
        return { view: 'details', editFrom: 'header' };
      }
      return null;
    });
  }, []);

  const handleOpenSing = useCallback(() => {
    if (roomMode === 'Party' && currentlySinging) {
      setIsLyricsOverlayOpen(true);
      return;
    }
    setIsSongSelectorOpen(true);
  }, [roomMode, currentlySinging]);

  const partyHeaderMenuItems = useMemo<RoomHeaderMenuItem[]>(
    () => [
      {
        id: 'details',
        label: 'Room details',
        icon: <Info size={15} aria-hidden />,
        onClick: openRoomDetails,
      },
      {
        id: 'edit',
        label: 'Edit room settings',
        icon: <Settings2 size={15} aria-hidden />,
        onClick: openRoomEdit,
        hidden: !canEditRoomAnnouncement,
      },
      {
        id: 'sing',
        label: currentlySinging ? 'Open lyrics' : 'Sing a song',
        icon: <Music size={15} aria-hidden />,
        onClick: handleOpenSing,
        hidden: isLyricsOverlayOpen,
        badge: songQueue.length,
      },
      {
        id: 'share',
        label: 'Share room',
        icon: <ShareIcon size="room" tone="inherit" className="h-4 w-4" />,
        onClick: () => setIsShareRoomOpen(true),
      },
      {
        id: 'announcement',
        label: 'Edit announcement',
        icon: <Pencil size={15} aria-hidden />,
        onClick: handleOpenAnnouncementEditor,
        hidden: !canEditRoomAnnouncement,
      },
    ],
    [
      openRoomDetails,
      openRoomEdit,
      canEditRoomAnnouncement,
      currentlySinging,
      handleOpenSing,
      isLyricsOverlayOpen,
      songQueue.length,
      handleOpenAnnouncementEditor,
    ],
  );

  const chorusHeaderMenuItems = useMemo<RoomHeaderMenuItem[]>(
    () => [
      {
        id: 'details',
        label: 'Room details',
        icon: <Info size={15} aria-hidden />,
        onClick: openRoomDetails,
      },
      {
        id: 'edit',
        label: 'Edit room settings',
        icon: <Settings2 size={15} aria-hidden />,
        onClick: openRoomEdit,
        hidden: !canEditRoomAnnouncement,
      },
      {
        id: 'share',
        label: 'Share room',
        icon: <ShareIcon size="room" tone="inherit" className="h-4 w-4" />,
        onClick: () => setIsShareRoomOpen(true),
      },
      {
        id: 'announcement',
        label: 'Edit announcement',
        icon: <Pencil size={15} aria-hidden />,
        onClick: handleOpenAnnouncementEditor,
        hidden: !canEditRoomAnnouncement,
      },
    ],
    [
      openRoomDetails,
      openRoomEdit,
      canEditRoomAnnouncement,
      handleOpenAnnouncementEditor,
    ],
  );

  const handleOpenRoomBackgroundMenu = () => {
    if (!canChangeRoomBackground) return;
    setIsRoomBackgroundMenuOpen(true);
  };

  useEffect(() => {
    if (!canChangeRoomBackground && isRoomBackgroundMenuOpen) {
      setIsRoomBackgroundMenuOpen(false);
      setPendingBackgroundMode(null);
    }
  }, [canChangeRoomBackground, isRoomBackgroundMenuOpen]);

  useEffect(() => {
    setBackgroundMode(parseRoomBackground(liveSettings.background));
    setRoomMode(roomLayoutConfig.layout);
    setIsFullPartyMode(roomLayoutConfig.isFullPartyMode);
  }, [liveSettings.background, roomLayoutConfig]);

  useEffect(() => {
    if (mapSettingsModeToRoomMode(liveSettings.roomMode) !== 'WatchTogether') return;
    void hydrateWatchTogetherMedia(roomDisplayId);
  }, [liveSettings.roomMode, liveSettings.watchTogetherMediaUrl, roomDisplayId]);

  const [viewers, setViewers] = useState<RoomViewerEntry[]>(() =>
    buildViewersFromPartyState(liveSettings, activeSeats, self, roomDisplayId),
  );

  const getSelfJoinContext = useCallback((): RoomJoinContext => {
    return buildSelfRoomJoinContext(
      liveSettings,
      self.id,
      isRoomAdminOrOwner(currentUserRole),
    );
  }, [liveSettings, self.id, currentUserRole]);

  useEffect(() => {
    setViewers((prev) =>
      mergeViewerJoinTimestamps(
        buildViewersFromPartyState(liveSettings, activeSeats, self, roomDisplayId),
        prev,
      ),
    );
  }, [
    liveSettings,
    activeSeats,
    self.id,
    self.roomName,
    self.avatarUrl,
    roomDisplayId,
    self,
  ]);

  useEffect(() => {
    seedDemoRoomMedia(roomDisplayId, []);
    const seatMembers = Object.values(activeSeats)
      .filter((guest): guest is Guest => guest !== null)
      .map((guest) => ({ name: guest.name, avatar: guest.avatar }));
    const viewerMembers = viewers.map((viewer) => ({
      name: viewer.name,
      avatar: viewer.avatar,
    }));
    syncRoomMemberAvatars(roomDisplayId, [...seatMembers, ...viewerMembers]);
  }, [roomDisplayId, activeSeats, viewers]);

  const [profilePreviewViewerId, setProfilePreviewViewerId] = useState<string | null>(null);
  const profilePreviewSuppressUntilRef = useRef(0);

  const profilePreviewUser = useMemo(() => {
    if (!profilePreviewViewerId) return null;
    const viewer = viewers.find((entry) => entry.id === profilePreviewViewerId);
    if (!viewer) return null;
    return buildRoomProfilePreview(viewer, liveSettings, self);
  }, [profilePreviewViewerId, viewers, liveSettings, self, dbRevision]);

  const closeProfilePreview = useCallback(() => {
    profilePreviewSuppressUntilRef.current = Date.now() + 400;
    setProfilePreviewViewerId(null);
  }, []);

  const handleToggleFollow = (viewerId: string) => {
    setViewers(prev => prev.map(v => {
      if (v.id !== viewerId && v.name !== viewerId) return v;

      let nextFollowing = !v.isFollowing;
      let targetUserId: string | null = null;
      if (v.id && db.users.some((user) => user.id === v.id)) {
        targetUserId = v.id;
      } else if (v.isOwner) {
        targetUserId = resolveOwnerUserId(liveSettings);
      } else {
        targetUserId = resolveRoomViewerUserId(v, liveSettings);
      }

      if (targetUserId && targetUserId !== self.id) {
        const toggled = db.toggleFollow(targetUserId);
        if (toggled !== null) {
          nextFollowing = toggled;
        }
      }

      showToast(nextFollowing ? `Followed ${v.name}` : `Unfollowed ${v.name}`);

      return { ...v, isFollowing: nextFollowing };
    }));

    // Also update seat frames / indicators if matched
    setActiveSeats(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => {
        const occupant = copy[k];
        if (occupant && (occupant.name === viewerId || occupant.joinedText === viewerId)) {
          copy[k] = { ...occupant, customBadge: occupant.customBadge }; // triggers re-render state
        }
      });
      return copy;
    });
  };

  const handleSelectViewer = (
    viewer: Pick<RoomViewerEntry, 'id' | 'name' | 'avatar'> &
      Partial<Pick<RoomViewerEntry, 'isFollowing' | 'isAdmin' | 'isOwner'>>,
  ) => {
    if (Date.now() < profilePreviewSuppressUntilRef.current) return;
    setProfilePreviewViewerId(viewer.id);
  };

  const handleToggleAdmin = (viewerId: string) => {
    setViewers(prev => prev.map(v => {
      if (v.id === viewerId) {
        showToast(v.isAdmin ? `${v.name} is no longer an admin` : `${v.name} is now an admin`);
        return { ...v, isAdmin: !v.isAdmin };
      }
      return v;
    }));
  };

  const handleToggleCoOwner = (viewerId: string) => {
    const viewer = viewers.find((entry) => entry.id === viewerId);
    if (!viewer || !isRoomOwner(currentUserRole)) return;
    if (viewer.isOwner) {
      showToast('The room owner cannot be assigned as co-owner.');
      return;
    }

    const resolvedUserId = resolveRoomViewerUserId(viewer, liveSettings);

    if (viewer.isCoOwner || isRoomCoOwnerUser(liveSettings, resolvedUserId)) {
      clearRoomCoOwner(roomDisplayId);
      showToast(`${viewer.name} is no longer co-owner`);
    } else {
      if (!resolvedUserId) {
        showToast('Could not link this viewer to an app account for co-owner access.');
        return;
      }
      const identity = resolveRoomMemberIdentity(resolvedUserId, viewer.name, roomDisplayId);
      assignRoomCoOwner(roomDisplayId, resolvedUserId, identity.name);
      showToast(`${identity.name} is now co-owner`);
    }
    refreshLiveSettings();
  };

  const handleKickUser = (viewerId: string, viewerName: string) => {
    // 1. Post simulated system messages inside chats
    const kickNotice = `👢 @${viewerName} was kicked from the room by the room administration`;
    
    setLiveChatMsgs(prev => [
      ...prev,
      {
        id: Date.now(),
        user: "SYSTEM",
        isOwner: false,
        isAdmin: true,
        isSystem: true,
        text: kickNotice,
        iconBadge: "ban"
      }
    ].slice(-15));

    setMessages(prev => [
      ...prev,
      {
        isSystem: true,
        text: kickNotice,
        iconBadge: "ban"
      }
    ]);

    // 2. Free up any occupied seats
    setActiveSeats(prev => {
      const copy = { ...prev };
      let seatKicked = false;
      Object.keys(copy).forEach(k => {
        const occupant = copy[k];
        if (occupant && occupant.name === viewerName) {
          copy[k] = null;
          seatKicked = true;
        }
      });
      if (seatKicked) {
        showToast(`Freed seat held by ${viewerName}`);
      }
      return copy;
    });

    // 3. Kick from viewers list
    setViewers(prev => prev.filter(v => v.id !== viewerId && v.name !== viewerName));

    showToast(`Successfully kicked ${viewerName} from the room!`);

    // 4. Close preview card if it was this user
    if (
      profilePreviewViewerId &&
      (profilePreviewViewerId === viewerId || profilePreviewUser?.displayName === viewerName)
    ) {
      setProfilePreviewViewerId(null);
    }
  };

  const [isAllGuestMuted, setIsAllGuestMuted] = useState(false);

  const guestFollowState = useCallback(
    (guest: Guest | null | undefined) => {
      if (!guest) return false;
      if (guest.userId) return db.isFollowingUser(guest.userId);
      return viewers.find((viewer) => viewer.name === guest.name)?.isFollowing ?? false;
    },
    [viewers],
  );

  const buildViewerFromGuest = useCallback(
    (guest: Guest, seatKey: string) => {
      const identity = resolveRoomMemberIdentity(guest.userId, guest.name, roomDisplayId);
      const userId = identity.userId ?? guest.userId ?? seatKey;
      const role = resolveMemberRoleForUser(liveSettings, userId);
      return {
        id: userId,
        name: identity.name,
        avatar: identity.avatarUrl,
        isOwner: role === 'owner' || Boolean(guest.isOwner ?? seatKey === 'host'),
        isCoOwner: role === 'co-owner' || seatKey === 'coowner',
        isAdmin: role === 'admin' || Boolean(guest.isAdmin),
        isFollowing: guestFollowState(guest),
      };
    },
    [guestFollowState, liveSettings, roomDisplayId],
  );

  type ChatAuthorMsg = {
    user?: string;
    userId?: string;
    isOwner?: boolean;
    isAdmin?: boolean;
  };

  const resolveChatAuthor = useCallback(
    (msg: ChatAuthorMsg) => {
      const rawLabel = msg.user?.trim() || 'Guest';
      const displayName = rawLabel.replace(/^@/, '');

      if (msg.userId?.trim()) {
        const identity = resolveRoomMemberIdentity(msg.userId, displayName, roomDisplayId, 80);
        return {
          id: msg.userId.trim(),
          name: identity.name,
          avatar: identity.avatarUrl,
        };
      }

      if (isRoomSelfName(rawLabel, self) || rawLabel === self.chatLabel) {
        return {
          id: self.id,
          name: self.roomName,
          avatar: self.avatarUrl,
        };
      }

      const viewer = viewers.find(
        (entry) =>
          entry.id === rawLabel ||
          entry.name === rawLabel ||
          entry.name === displayName,
      );
      if (viewer) {
        const identity = resolveRoomMemberIdentity(
          resolveRoomViewerUserId(viewer, liveSettings) ?? viewer.id,
          viewer.name,
          roomDisplayId,
          80,
        );
        return {
          id: identity.userId ?? viewer.id,
          name: identity.name,
          avatar: identity.avatarUrl,
        };
      }

      const seatedGuest = Object.values(activeSeats).find(
        (guest): guest is Guest =>
          guest !== null &&
          (guest.name === rawLabel ||
            guest.name === displayName ||
            guest.userId === rawLabel),
      );
      if (seatedGuest) {
        const identity = resolveRoomMemberIdentity(
          seatedGuest.userId,
          seatedGuest.name,
          roomDisplayId,
          80,
        );
        return {
          id: seatedGuest.userId ?? seatedGuest.name,
          name: identity.name,
          avatar: identity.avatarUrl,
        };
      }

      if (msg.isOwner) {
        const ownerId = resolveOwnerUserId(liveSettings);
        const ownerName = resolveOwnerDisplayName(liveSettings, 'Host');
        const identity = resolveRoomMemberIdentity(ownerId, ownerName, roomDisplayId, 80);
        return {
          id: ownerId ?? identity.userId ?? ownerName,
          name: identity.name,
          avatar: identity.avatarUrl,
        };
      }

      const identity = resolveRoomMemberIdentity(undefined, displayName, roomDisplayId, 80);
      return {
        id: identity.userId ?? `chat-${displayName}`,
        name: identity.name,
        avatar: identity.avatarUrl,
      };
    },
    [activeSeats, liveSettings, roomDisplayId, self, viewers],
  );

  const buildChatViewerPayload = useCallback(
    (msg: ChatAuthorMsg) => {
      const author = resolveChatAuthor(msg);
      const roleFlags = resolveChatRoleFlags(liveSettings, author.id, {
        sessionRole: currentUserRole,
        sessionUserId: self.id,
      });
      return {
        id: author.id,
        name: author.name,
        avatar: author.avatar,
        isOwner: roleFlags.isOwner,
        isCoOwner: roleFlags.isCoOwner,
        isAdmin: roleFlags.isAdmin,
        isFollowing:
          viewers.find(
            (entry) => entry.id === author.id || entry.name === author.name,
          )?.isFollowing ?? false,
      };
    },
    [resolveChatAuthor, viewers, liveSettings, currentUserRole, self.id],
  );

  const formatLiveChatUserLabel = useCallback(
    (msg: ChatAuthorMsg) => formatRoomChatUserLabel(resolveChatAuthor(msg), self, msg.user),
    [resolveChatAuthor, self],
  );

  type SingChatMsg = ChatAuthorMsg & {
    id: string | number;
    isSingEvent?: 'start' | 'end';
    songTitle?: string;
    score?: number;
  };

  const renderSingChatEvent = useCallback(
    (message: SingChatMsg) => {
      if (!message.isSingEvent || !message.songTitle) return null;
      const chatAuthor = resolveChatAuthor(message);
      const singerLabel = formatRoomSelfLabel(chatAuthor.name, self);
      const phaseLabel = message.isSingEvent === 'start' ? 'started' : 'finished';
      const bodyText =
        message.isSingEvent === 'start'
          ? `singing "${message.songTitle}"`
          : message.score != null
            ? `finished singing "${message.songTitle}" · Score ${message.score}`
            : `finished singing "${message.songTitle}"`;

      return (
        <div
          key={message.id}
          className="bg-purple-900/40 backdrop-blur-md rounded-2xl p-4 border border-white/5 w-fit max-w-[85%] shadow-xl animate-fade-in"
        >
          <div className="flex items-center space-x-2 mb-1">
            <img
              src={safeAvatarUrl(chatAuthor.avatar)}
              alt=""
              className="party-chat-avatar rounded-full object-cover border border-purple-500/30 shrink-0"
            />
            <span className="text-white font-black text-xs">{singerLabel}</span>
            <span className="text-gray-400 text-[10px]">{phaseLabel}</span>
          </div>
          <div className="text-xs text-gray-300 leading-relaxed font-black">{bodyText}</div>
        </div>
      );
    },
    [resolveChatAuthor, self],
  );

  type JoinChatMsg = ChatAuthorMsg & {
    id: string | number;
    isJoinEvent?: boolean;
    text?: string;
  };

  type AnnouncementWelcomeChatMsg = {
    id: string | number;
    isAnnouncementWelcome: true;
    targetViewerId: string;
    targetViewerName: string;
    targetViewerAvatar?: string;
  };

  const renderChatRoleBadges = useCallback(
    (flags: ChatRoleFlags) => <ChatRoleBadges {...flags} />,
    [],
  );

  const renderJoinChatEvent = useCallback(
    (message: JoinChatMsg) => {
      if (!message.isJoinEvent) return null;
      const chatAuthor = resolveChatAuthor(message);
      const chatViewer = buildChatViewerPayload(message);
      return (
        <div
          key={message.id}
          className="party-chat-join-line font-black text-gray-400 flex items-start gap-1.5 bg-black/25 px-2.5 py-1.5 rounded-lg w-fit max-w-[95%] ml-[2px] animate-fade-in my-1.5 border border-white/5 cursor-pointer hover:bg-black/40 transition select-none"
          onClick={() => handleSelectViewer(chatViewer)}
        >
          <img
            src={safeAvatarUrl(chatAuthor.avatar)}
            alt=""
            className="party-chat-avatar rounded-full object-cover border border-purple-500/30 shrink-0"
          />
          <div className="party-chat-join-line-body flex min-w-0 flex-col leading-tight">
            <div className="party-chat-join-line-user flex min-w-0 items-center gap-1">
              <span className="shrink-0 text-teal-400">🎤</span>
              <span className="truncate text-white font-black">{formatLiveChatUserLabel(message)}</span>
            </div>
            <span className="party-chat-join-line-action">joined the room</span>
          </div>
        </div>
      );
    },
    [buildChatViewerPayload, formatLiveChatUserLabel, handleSelectViewer, resolveChatAuthor],
  );

  type GiftChatMsg = ChatAuthorMsg & {
    id: string | number;
    isGiftEvent?: boolean;
    giftIcon?: string;
    giftName?: string;
    receiver?: string;
    giftAmount?: number;
  };

  const renderGiftChatEvent = useCallback(
    (message: GiftChatMsg) => {
      if (!message.isGiftEvent) return null;
      const giftAuthor = resolveChatAuthor(message);
      return (
        <div
          key={message.id}
          className="bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-black/20 border border-pink-500/15 rounded-2xl p-2.5 my-1.5 animate-fade-in text-left"
        >
          <div className="flex items-center space-x-1.5 flex-wrap party-chat-gift-line">
            <img
              src={safeAvatarUrl(giftAuthor.avatar)}
              alt=""
              className="party-chat-avatar rounded-full object-cover border border-purple-500/30 shrink-0"
            />
            <span className="text-[14px]">{message.giftIcon}</span>
            <span className="font-black text-pink-400">{formatLiveChatUserLabel(message)}</span>
            <span className="text-gray-300">sent</span>
            <span className="font-black text-yellow-300 uppercase tracking-widest">
              {message.giftName} {message.giftIcon}
            </span>
            <span className="text-gray-300">to</span>
            <span className="font-black text-cyan-300">@{message.receiver}</span>
          </div>
          {message.giftAmount != null && (
            <div className="party-chat-gift-line text-pink-400/90 font-mono font-bold mt-1 pl-[24px]">
              🔥 Score boosted is +{message.giftAmount}! Participant list updated.
            </div>
          )}
        </div>
      );
    },
    [formatLiveChatUserLabel, resolveChatAuthor],
  );

  const renderStandardChatMessage = useCallback(
    (
      message: ChatAuthorMsg & { id: string | number; text?: string },
      options?: { bubbleClassName?: string; layout?: 'stacked' | 'inline' },
    ) => {
      const chatAuthor = resolveChatAuthor(message);
      const chatViewer = buildChatViewerPayload(message);
      const layout = options?.layout ?? 'stacked';
      const bubbleClassName =
        options?.bubbleClassName ??
        'bg-black/40 backdrop-blur-md border border-white/5';

      const usernameRow = (
        <div className="flex items-center space-x-1 flex-wrap">
          <span
            onClick={() => handleSelectViewer(chatViewer)}
            className="party-chat-username font-black text-gray-300 uppercase shrink-0 cursor-pointer hover:underline hover:text-white transition-colors"
          >
            {formatLiveChatUserLabel(message)}
          </span>
          {renderChatRoleBadges({
            isOwner: chatViewer.isOwner,
            isCoOwner: chatViewer.isCoOwner ?? false,
            isAdmin: chatViewer.isAdmin,
          })}
        </div>
      );

      const bubble = (
        <div
          className={`${bubbleClassName} ${
            layout === 'inline'
              ? 'rounded-2xl rounded-tl-none w-fit max-w-full'
              : 'rounded-2xl party-chat-bubble-indent w-fit max-w-[85%]'
          } px-2.5 py-1.5 text-left`}
        >
          <div className="party-chat-bubble-text font-bold text-[#faf9f3] tracking-wide break-words">
            {renderMessageTextWithMentions(message.text ?? '')}
          </div>
        </div>
      );

      if (layout === 'inline') {
        return (
          <div
            key={message.id}
            className="party-chat-message-inline w-full max-w-full animate-fade-in group text-left"
          >
            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-2 gap-y-0.5">
              <img
                src={safeAvatarUrl(chatAuthor.avatar)}
                alt=""
                className="party-chat-avatar row-span-2 self-start rounded-full object-cover border border-white/10 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                onClick={() => handleSelectViewer(chatViewer)}
              />
              <div className="col-start-2 row-start-1 min-w-0">{usernameRow}</div>
              <div className="col-start-2 row-start-2 min-w-0">{bubble}</div>
            </div>
          </div>
        );
      }

      return (
        <div key={message.id} className="flex flex-col space-y-1 pl-[2px] animate-fade-in transition-all">
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
            <img
              src={safeAvatarUrl(chatAuthor.avatar)}
              alt=""
              className="party-chat-avatar rounded-full object-cover border border-purple-500/30 shrink-0 cursor-pointer hover:scale-105 transition-transform"
              onClick={() => handleSelectViewer(chatViewer)}
            />
            {usernameRow}
          </div>
          {bubble}
        </div>
      );
    },
    [
      buildChatViewerPayload,
      formatLiveChatUserLabel,
      handleSelectViewer,
      renderChatRoleBadges,
      renderMessageTextWithMentions,
      resolveChatAuthor,
    ],
  );

  const roomOwnerChatIdentity = useMemo(
    () =>
      resolveRoomMemberIdentity(
        resolveOwnerUserId(liveSettings),
        resolveOwnerDisplayName(liveSettings, 'Host'),
        roomDisplayId,
        80,
      ),
    [liveSettings, roomDisplayId],
  );

  const roomOwnerRoleFlags = useMemo(
    () =>
      resolveChatRoleFlags(liveSettings, roomOwnerChatIdentity.userId, {
        sessionRole: currentUserRole,
        sessionUserId: self.id,
      }),
    [liveSettings, roomOwnerChatIdentity.userId, currentUserRole, self.id],
  );

  const handleSelectRoomOwner = useCallback(() => {
    handleSelectViewer({
      id: roomOwnerChatIdentity.userId ?? 'room-owner',
      name: roomOwnerChatIdentity.name,
      avatar: roomOwnerChatIdentity.avatarUrl,
      isOwner: true,
      isAdmin: false,
      isFollowing:
        viewers.find(
          (entry) =>
            entry.id === roomOwnerChatIdentity.userId || entry.name === roomOwnerChatIdentity.name,
        )?.isFollowing ?? false,
    });
  }, [handleSelectViewer, roomOwnerChatIdentity, viewers]);

  const renderAnnouncementWelcome = useCallback(
    (message: AnnouncementWelcomeChatMsg) => {
      const welcome = buildViewerRoomWelcome(liveSettings, message.targetViewerName);
      if (!welcome) return null;

      const recipientViewer = viewers.find(
        (entry) =>
          entry.id === message.targetViewerId || entry.name === message.targetViewerName,
      );

      return (
        <RoomAnnouncementChatPin
          key={message.id}
          pinId={`room-announcement-welcome-${message.id}`}
          welcome={welcome}
          roomLevel={roomExpProgress.level}
          ownerName={roomOwnerChatIdentity.name}
          ownerAvatar={roomOwnerChatIdentity.avatarUrl}
          ownerRoleFlags={roomOwnerRoleFlags}
          onSelectOwner={handleSelectRoomOwner}
          onSelectRecipient={() =>
            handleSelectViewer({
              id: message.targetViewerId,
              name: message.targetViewerName,
              avatar:
                message.targetViewerAvatar ??
                recipientViewer?.avatar ??
                roomOwnerChatIdentity.avatarUrl,
              isFollowing: recipientViewer?.isFollowing ?? false,
              isAdmin: recipientViewer?.isAdmin ?? false,
              isOwner: recipientViewer?.isOwner ?? false,
            })
          }
        />
      );
    },
    [
      liveSettings,
      roomExpProgress.level,
      roomOwnerChatIdentity,
      roomOwnerRoleFlags,
      handleSelectRoomOwner,
      handleSelectViewer,
      viewers,
    ],
  );

  const handleToggleSeatMic = (seatKey: string) => {
    const seatValue = activeSeats[seatKey];
    if (!seatValue) return;

    const isSelf =
      isRoomSelfGuest(seatValue, self) ||
      (seatKey === "host" && isRoomOwner(currentUserRole)) ||
      (seatKey === "coowner" && (isRoomCoOwner(currentUserRole) || isRoomOwner(currentUserRole))) ||
      (seatKey === "admin" && (selfCanTakeAdminSeat || isRoomOwner(currentUserRole)));
    const isAdminOrHost = isRoomAdminOrOwner(currentUserRole);
    const isAllowedToManage = isSelf || isAdminOrHost;

    if (!isAllowedToManage) {
      showToast("Only Owner, Admin, or the occupant can manage this microphone!");
      return;
    }

    const nextSpeaking = !seatValue.isSpeaking;

    // Strict constraint: if a normal user (isSelf but not admin/host) tries to UNMUTE and they are admin-muted, deny it!
    if (nextSpeaking && seatValue.isAdminMuted && !isAdminOrHost) {
      showToast("Your mic was locked/muted by the Room Owner/Admin. You cannot unmute yourself.");
      return;
    }

    // Determine what the new isAdminMuted flag should be.
    // If an Admin/Host is muting another guest seat, set isAdminMuted to true.
    // If an Admin/Host is unmuting another guest seat, set isAdminMuted to false (unlocked).
    // If a user is muting themselves, isAdminMuted remains false.
    let nextAdminMuted = seatValue.isAdminMuted || false;
    if (isAdminOrHost && !isSelf) {
      nextAdminMuted = !nextSpeaking;
    } else if (isSelf) {
      // If unmuting themselves (and not blocked), clear isAdminMuted
      if (nextSpeaking) {
        nextAdminMuted = false;
      }
    }

    setActiveSeats(prev => {
      const occupant = prev[seatKey];
      if (!occupant) return prev;
      return {
        ...prev,
        [seatKey]: {
          ...occupant,
          isSpeaking: nextSpeaking,
          isAdminMuted: nextAdminMuted
        }
      };
    });

    if (isSelf) {
      showToast(nextSpeaking ? "You unmuted your microphone!" : "You muted your microphone!");
      if (seatKey === "host") {
        setIsMuted(!nextSpeaking);
      }
    } else {
      if (nextAdminMuted) {
        showToast(`Muted and locked microphone of ${seatValue.name}`);
      } else {
        showToast(`Unmuted and unlocked microphone of ${seatValue.name}`);
      }
    }
  };

  const handleToggleAllMics = () => {
    const nextMuteState = !isAllGuestMuted;
    setIsAllGuestMuted(nextMuteState);

    setActiveSeats(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => {
        if (!isPartyStaffSeatKey(k)) {
          const occupant = copy[k];
          if (occupant) {
            copy[k] = { 
              ...occupant, 
              isSpeaking: !nextMuteState,
              isAdminMuted: nextMuteState // locks if muting all, unlocks if unmuting all
            };
          }
        }
      });
      return copy;
    });

    if (nextMuteState) {
      showToast("Muted and locked all guest microphones!");
    } else {
      showToast("Unmuted and unlocked all guest microphones!");
    }
  };

  // State governing whether neighboring guest seats are mutual followers (heartbeat lights up pink-neon) or not (heartbeat stays dim gray)
  const [mutuallyFollowing, setMutuallyFollowing] = useState<Record<string, boolean>>({
    "no1-no2": true,
    "no2-no3": true,
    "no3-no4": true,
    "no2-host": true,
    "host-no3": true,
    "no5-no6": false,
    "no6-no7": false,
    "no7-no8": false,
    "no8-no9": false,
  });

  // Action callback to toggle relation & show lovely floating feed notice
  const toggleHeartbeat = (key1: string, key2: string) => {
    if (!activeSeats[key1] || !activeSeats[key2]) return;

    const relKey = `${key1}-${key2}`;
    setMutuallyFollowing(prev => {
      const isNowActive = !prev[relKey];
      const name1 = activeSeats[key1]?.name || `Seat ${key1.replace("no", "")}`;
      const name2 = activeSeats[key2]?.name || `Seat ${key2.replace("no", "")}`;
      
      // Inject beautifully styled notification to the interactive chat log feed!
      setMessages(msgs => [
        ...msgs,
        {
          isSystem: false,
          isJoinEvent: true,
          user: isNowActive ? "💝 SYSTEM" : "💔 SYSTEM",
          text: isNowActive 
            ? `engaged! ${name1.split(' ')[0]} ⇄ ${name2.split(' ')[0]} are now mutually following! Heartbeat line LIT UP!`
            : `disconnected! ${name1.split(' ')[0]} and ${name2.split(' ')[0]} follow link removed.`,
        }
      ]);
      return {
        ...prev,
        [relKey]: isNowActive
      };
    });
  };

  const showToast = (message: string) => {
    if (roomMode === 'WatchTogether') {
      setLiveChatMsgs((prev) =>
        [...prev, { id: Date.now(), isSystem: true, text: message }].slice(-50),
      );
      return;
    }
    window.dispatchEvent(new CustomEvent('app-toast', { detail: message }));
  };

  const ownerSocial = useRoomOwnerSocial(roomDisplayId, liveSettings, self.id, {
    onToast: showToast,
  });

  const isStageActive = isSingingMode && currentlySinging !== null;

  const isSeatCurrentlySinging = (guestName: string) =>
    isStageActive && currentSingerName === guestName;

  const isSeatVoiceActive = (guest: Guest) =>
    guest.isSpeaking && !guest.isAdminMuted && !isSeatCurrentlySinging(guest.name);

  const isSeatVoiceVisualActive = (guest: Guest, seatKey: string) => {
    if (!isSeatVoiceActive(guest)) return false;
    if (seatKey === userSeatKey) return userVoiceActive;
    return true;
  };

  const seatVoicePulse = (seatKey: string) =>
    seatKey === userSeatKey && userMicOn ? userMicLevel : audioPulse;

  const resolveSingerUserId = useCallback((singerName: string): string | undefined => {
    if (isRoomSelfName(singerName, self)) return self.id;
    const seated = Object.values(activeSeats).find(
      (guest): guest is Guest => guest !== null && guest.name === singerName,
    );
    return seated?.userId;
  }, [activeSeats, self]);

  const appendLiveChatMsg = useCallback((message: Record<string, unknown>) => {
    setLiveChatMsgs((prev) => [...prev, message].slice(-50));
  }, []);

  const pushRoomChatMessage = useCallback((message: {
    id: string;
    user: string;
    userId?: string;
    text: string;
    isJoinEvent?: boolean;
    isOwner?: boolean;
    isAdmin?: boolean;
    isBurmese?: boolean;
  }) => {
    if (roomMode === 'Chorus' || usesLivePartyFeed) {
      appendLiveChatMsg(message);
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        isSystem: false,
        user: message.user,
        userId: message.userId,
        text: message.text,
        isJoinEvent: message.isJoinEvent,
        isOwner: message.isOwner,
        isAdmin: message.isAdmin,
        isBurmese: message.isBurmese ?? false,
      },
    ]);
  }, [appendLiveChatMsg, roomMode, usesLivePartyFeed]);

  const announceUserJoinedRoom = useCallback((
    userId: string,
    displayName: string,
    options?: { allowRepeat?: boolean },
  ) => {
    const id = userId.trim();
    const name = displayName.trim();
    if (!id || !name) return;
    if (!options?.allowRepeat && announcedJoinUserIdsRef.current.has(id)) return;
    announcedJoinUserIdsRef.current.add(id);

    const roleFlags = resolveChatRoleFlags(liveSettings, id, {
      sessionRole: id === self.id ? currentUserRole : null,
      sessionUserId: self.id,
    });

    pushRoomChatMessage({
      id: `join_${id}_${Date.now()}`,
      user: name,
      userId: id,
      isJoinEvent: true,
      isOwner: roleFlags.isOwner,
      isAdmin: roleFlags.isAdmin,
      text: 'joined the room',
    });

    if (id !== self.id) {
      const identity = resolveRoomMemberIdentity(id, name, roomDisplayId, 80);
      appendLiveChatMsg({
        id: `welcome_${id}_${Date.now()}`,
        isAnnouncementWelcome: true,
        targetViewerId: id,
        targetViewerName: name,
        targetViewerAvatar: identity.avatarUrl,
      });
    }
  }, [appendLiveChatMsg, currentUserRole, liveSettings, pushRoomChatMessage, roomDisplayId, self.id]);

  announceUserJoinedRoomRef.current = announceUserJoinedRoom;

  const handleAcceptRequest = useCallback((reqId: string) => {
    const emptySeatEntry = Object.entries(activeSeats).find(([key, guest]) => key !== 'host' && guest === null);
    if (!emptySeatEntry) return;
    const [emptySeatKey] = emptySeatEntry;
    const acceptedReq = guestRequests.find((request) => request.id === reqId);
    if (!acceptedReq) return;

    setActiveSeats((prev) => ({
      ...prev,
      [emptySeatKey]: createGuestFromRequest(acceptedReq, roomDisplayId),
    }));
    setGuestRequests((prev) => prev.filter((request) => request.id !== reqId));
    announceUserJoinedRoom(acceptedReq.userId ?? acceptedReq.id, acceptedReq.name);
  }, [activeSeats, announceUserJoinedRoom, guestRequests, roomDisplayId]);

  useEffect(() => {
    announcedJoinUserIdsRef.current = new Set();
  }, [roomDisplayId]);

  useEffect(() => {
    if (!hasPrivateKeyAccess) return;
    if (!self.id || !self.roomName.trim()) return;
    announceUserJoinedRoom(self.id, self.roomName);
  }, [roomDisplayId, announceUserJoinedRoom, self.id, self.roomName, hasPrivateKeyAccess]);

  const announceSongStart = useCallback((song: { title: string }, singerName: string) => {
    appendLiveChatMsg({
      id: `sing_start_${Date.now()}`,
      user: singerName,
      userId: resolveSingerUserId(singerName),
      isSingEvent: 'start',
      songTitle: song.title,
    });
  }, [appendLiveChatMsg, resolveSingerUserId]);

  const announceSongEnd = useCallback((
    song: { title: string },
    singerName: string,
    score?: number,
  ) => {
    appendLiveChatMsg({
      id: `sing_end_${Date.now()}`,
      user: singerName,
      userId: resolveSingerUserId(singerName),
      isSingEvent: 'end',
      songTitle: song.title,
      score,
    });
  }, [appendLiveChatMsg, resolveSingerUserId]);

  const startPerformance = (song: { id?: string; title: string; artist: string }, singerName: string) => {
    const activeSong = resolveActiveSong(song);
    setCurrentlySinging(activeSong);
    setCurrentSingerName(singerName);
    setIsSingingMode(true);
    if (roomMode === 'Chorus') {
      setChorusScore(0);
    }
    announceSongStart(activeSong, singerName);
  };

  const prepareLyricsForSong = (song: { id?: string; title: string; artist: string }) => {
    setCurrentlySinging(resolveActiveSong(song));
    setIsLyricsOverlayOpen(true);
  };

  const beginSingingFromOverlay = () => {
    if (!currentlySinging) return;

    if (isStageActive && currentSingerName !== self.roomName) {
      showToast("Wait for the current performance to finish.");
      return;
    }

    if (isSingingMode) return;

    setCurrentSingerName(self.roomName);
    setIsSingingMode(true);
    announceSongStart(currentlySinging, self.roomName);
    showToast(`Sing "${currentlySinging.title}"!`);
  };

  const handleRequestSong = (song: { id?: string; title: string; artist: string; image?: string }) => {
    setIsSongSelectorOpen(false);

    if (roomMode === 'Chorus' && !isUserSeated) {
      showToast('Take a seat before requesting a song.');
      setLiveChatMsgs((prev) => [
        ...prev,
        {
          id: `seat_req_${Date.now()}`,
          user: 'ℹ️ Room',
          text: 'Take a seat before requesting a song.',
        },
      ]);
      return;
    }

    const queueEntry: QueuedSong = {
      id: song.id ?? `${song.title}-${Date.now()}`,
      title: song.title,
      artist: song.artist,
      requestedBy: self.roomName,
      requestedByUserId: self.id,
      image: song.image,
    };

    if (isStageActive && currentSingerName !== self.roomName) {
      setSongQueue(prev => {
        const existingIndex = prev.findIndex((entry) =>
          entry.requestedByUserId
            ? entry.requestedByUserId === self.id
            : isRoomSelfName(entry.requestedBy, self)
        );
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = queueEntry;
          showToast(`Updated your queued song to "${song.title}".`);
          return next;
        }
        const position = prev.length + 1;
        showToast(`"${song.title}" queued — you're #${position} in line.`);
        return [...prev, queueEntry];
      });
      return;
    }

    if (isStageActive && currentSingerName === self.roomName) {
      setSongQueue(prev => {
        const existingIndex = prev.findIndex((entry) =>
          entry.requestedByUserId
            ? entry.requestedByUserId === self.id
            : isRoomSelfName(entry.requestedBy, self)
        );
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = queueEntry;
          showToast(`Updated your queued song to "${song.title}".`);
          return next;
        }
        showToast(`"${song.title}" queued for after your current song.`);
        return [...prev, queueEntry];
      });
      return;
    }

    if (roomMode === 'Party') {
      prepareLyricsForSong(song);
      showToast(`"${song.title}" ready — tap SING on the lyrics card to start.`);
      return;
    }

    if (roomMode === 'Chorus' && songQueue.length > 0) {
      setSongQueue((prev) => {
        const existingIndex = prev.findIndex((entry) =>
          entry.requestedByUserId
            ? entry.requestedByUserId === self.id
            : isRoomSelfName(entry.requestedBy, self),
        );
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = queueEntry;
          showToast(`Updated your queued song to "${song.title}".`);
          return next;
        }
        const position = prev.length + 1;
        showToast(`"${song.title}" queued — you're #${position} in line.`);
        return [...prev, queueEntry];
      });
      return;
    }

    startPerformance(song, self.roomName);
    showToast(`You're up! Singing "${song.title}"`);
  };

  const cancelCurrentSong = () => {
    const abandonedTitle = currentlySinging?.title;
    if (isSingingMode && currentlySinging && currentSingerName) {
      announceSongEnd(
        currentlySinging,
        currentSingerName,
        roomMode === 'Chorus' ? chorusScore : undefined,
      );
    }
    setIsLyricsOverlayOpen(false);
    setIsSingingMode(false);
    setCurrentlySinging(null);
    setCurrentSingerName(null);
    setChorusScore(0);
    setSingingVoiceEffect('studio');
    if (abandonedTitle) {
      showToast(`Cancelled "${abandonedTitle}"`);
    }
  };

  const finishCurrentSong = () => {
    setIsQueueSheetOpen(false);
    setIsLyricsOverlayOpen(false);

    if (isSingingMode && currentlySinging && currentSingerName) {
      announceSongEnd(
        currentlySinging,
        currentSingerName,
        roomMode === 'Chorus' ? chorusScore : undefined,
      );
    }

    setSongQueue(prev => {
      if (prev.length > 0) {
        const [next, ...rest] = prev;

        if (roomMode === 'Party') {
          setCurrentlySinging(resolveActiveSong(next));
          setCurrentSingerName(null);
          setIsSingingMode(false);
          if (next.requestedBy === self.roomName) {
            setIsLyricsOverlayOpen(true);
          }
          showToast(
            next.requestedBy === self.roomName
              ? `Your turn — tap SING on "${next.title}"`
              : `"${next.title}" is up for @${next.requestedBy}`
          );
        } else {
          const activeSong = resolveActiveSong(next);
          setCurrentlySinging(activeSong);
          setCurrentSingerName(next.requestedBy);
          setIsSingingMode(true);
          setChorusScore(0);
          announceSongStart(activeSong, next.requestedBy);
          showToast(
            next.requestedBy === self.roomName
              ? `Your turn! Singing "${next.title}"`
              : `@${next.requestedBy} is now singing "${next.title}"`
          );
        }
        return rest;
      }

      setIsSingingMode(false);
      setCurrentlySinging(null);
      setCurrentSingerName(null);
      setChorusScore(0);
      setSingingVoiceEffect('studio');
      return prev;
    });
  };

  finishCurrentSongRef.current = finishCurrentSong;
  cancelCurrentSongRef.current = cancelCurrentSong;

  useEffect(() => {
    if (!isSingingMode || roomMode !== 'Chorus' || !currentlySinging) return;
    setChorusScore(0);
    sentenceBestScoresRef.current = {};
    sentenceRunningScoresRef.current = {};
    activeSentenceRef.current = 0;
  }, [currentlySinging?.id, isSingingMode, roomMode]);

  useEffect(() => {
    if (!isSingingMode || roomMode !== 'Chorus' || !currentlySinging) return;
    const tick = window.setInterval(() => {
      const voiceBoost = isSelfPerforming
        ? singingVoiceActive
          ? 16
          : 8
        : userVoiceActive
          ? 12
          : 5;
      const micBoost = isSelfPerforming ? Math.floor(singingMicLevel / 12) : 0;
      const increment = voiceBoost + micBoost + (audioPulse % 4);
      const sentenceIndex = performanceLyricIndex;

      const previousSentence = activeSentenceRef.current;
      if (sentenceIndex !== previousSentence) {
        const previousRunning = sentenceRunningScoresRef.current[previousSentence] ?? 0;
        const previousBest = sentenceBestScoresRef.current[previousSentence] ?? 0;
        sentenceBestScoresRef.current[previousSentence] = Math.max(previousBest, previousRunning);
        sentenceRunningScoresRef.current[sentenceIndex] = 0;
        activeSentenceRef.current = sentenceIndex;
      }

      const nextRunning = (sentenceRunningScoresRef.current[sentenceIndex] ?? 0) + increment;
      sentenceRunningScoresRef.current[sentenceIndex] = nextRunning;

      const merged = { ...sentenceBestScoresRef.current };
      const lineBest = merged[sentenceIndex] ?? 0;
      merged[sentenceIndex] = Math.max(lineBest, nextRunning);
      const nextTotal = Object.values(merged).reduce((sum, value) => sum + value, 0);
      setChorusScore(nextTotal);
    }, 2000);
    return () => window.clearInterval(tick);
  }, [
    isSingingMode,
    roomMode,
    currentlySinging?.id,
    userVoiceActive,
    audioPulse,
    isSelfPerforming,
    singingVoiceActive,
    singingMicLevel,
    performanceLyricIndex,
  ]);

  useEffect(() => {
    if (roomMode !== 'Chorus' || isUserSeated) return;

    let removedCount = 0;
    setSongQueue((prev) => {
      const filtered = prev.filter((entry) => {
        const shouldRemove = isRoomSelfName(entry.requestedBy, self);
        if (shouldRemove) removedCount += 1;
        return !shouldRemove;
      });
      return filtered.length === prev.length ? prev : filtered;
    });

    if (removedCount > 0) {
      showToast(`Left seat: removed ${removedCount} queued song${removedCount > 1 ? 's' : ''}.`);
    }
  }, [roomMode, isUserSeated, self]);

  useEffect(() => {
    if (roomMode !== 'Chorus' || isUserSeated) return;
    if (!isSingingMode || currentSingerName !== self.roomName) return;

    // Enforce karaoke rule: leaving seat immediately ends your active turn without advancing the queue.
    cancelCurrentSongRef.current();
    showToast('You left your seat — your song was stopped.');
  }, [roomMode, isUserSeated, isSingingMode, currentSingerName, self.roomName]);

  // Sync mode / settings with seat layout — keeps guest seats, reconciles host to room owner
  useEffect(() => {
    if (!usesLivePartyFeed) {
      setActiveSeats(createEmptyPartySeats());
      return;
    }
    setActiveSeats((prev) =>
      hydratePartySeatsWithStars(roomDisplayId, liveSettings, prev),
    );
  }, [usesLivePartyFeed, roomDisplayId, liveSettings.ownerUserId, liveSettings.owner, liveSettings.roomId, self.id, self.roomName, self.avatarUrl]);

  useEffect(() => {
    if (!usesLivePartyFeed) return;
    const allowAdminSeat = roomMode === 'Party' && !isFullPartyMode;
    if (allowAdminSeat) return;
    setActiveSeats((prev) => (prev.admin ? { ...prev, admin: null } : prev));
  }, [usesLivePartyFeed, roomMode, isFullPartyMode]);

  useEffect(() => {
    if (!usesLivePartyFeed) return;
    setActiveSeats((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const seatKey of ALL_SEAT_KEYS) {
        const guest = next[seatKey];
        if (!guest || !isRoomSelfGuest(guest, self)) continue;
        const refreshed = resolveSeatGuestDisplay(
          {
            ...guest,
            userId: self.id,
            name: self.roomName,
            avatar: self.avatarUrl,
          },
          roomDisplayId,
        );
        if (
          refreshed.userId === guest.userId &&
          refreshed.name === guest.name &&
          refreshed.avatar === guest.avatar
        ) {
          continue;
        }
        next[seatKey] = {
          ...refreshed,
          isSpeaking: guest.isSpeaking,
          isAdminMuted: guest.isAdminMuted,
          stars: guest.stars,
          frameStyle: guest.frameStyle,
          isAdmin: guest.isAdmin,
          isOwner: guest.isOwner,
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [usesLivePartyFeed, roomDisplayId, self.id, self.roomName, self.avatarUrl, self]);

  useEffect(() => {
    if (!usesLivePartyFeed) return;
    savePartySeats(roomDisplayId, activeSeats);
  }, [activeSeats, roomDisplayId, usesLivePartyFeed]);

  // Handle seat clicks
  const handleSeatClick = (seatKey: string) => {
    const occupant = activeSeats[seatKey as keyof PartySeatMap];
    if (!occupant) {
      if (seatKey === "host" && !isRoomOwner(currentUserRole)) {
        showToast("Only the room owner can take this seat!");
        return;
      }
      if (seatKey === "coowner" && !isRoomCoOwner(currentUserRole) && !isRoomOwner(currentUserRole)) {
        showToast("Only the room owner or co-owner can take this seat!");
        return;
      }
      if (seatKey === "admin" && !selfCanTakeAdminSeat && !isRoomOwner(currentUserRole)) {
        showToast("Only room admins, co-owners, or the owner can take this seat!");
        return;
      }

      // Check seat locked state
      if (lockedSeats[seatKey]) {
        const lockedLabel =
          seatKey === "coowner"
            ? "Co-owner seat"
            : seatKey === "admin"
              ? "Boss seat"
            : seatKey === "host"
              ? "Host seat"
              : `Seat ${seatKey.replace("no", "")}`;
        showToast(`${lockedLabel} has been locked by the Host/Admin!`);
        return;
      }

      if (roomIsPrivate && !hasPrivateKeyAccess) {
        showToast('Enter the room key before taking a seat.');
        return;
      }

      // Owner, co-owner, and admin bypass join/seat approval for guest seats.
      if (!isRoomEditorRole(currentUserRole)) {
        const joinContext = getSelfJoinContext();
        const joinCheck = canUserJoinRoom(liveSettings.whoCanJoin, joinContext);
        if (!joinCheck.allowed) {
          showToast(joinCheck.reason ?? 'You cannot join this room.');
          return;
        }

        const seatCheck = canUserTakeSeat(liveSettings.whoCanBeSeated, joinContext);
        if (!seatCheck.allowed) {
          showToast(seatCheck.reason ?? 'You cannot take a seat in this room.');
          return;
        }

        if (!joinWithoutRequest) {
          // Check if user already has a pending request
          if (guestRequests.some(r => r.name === self.roomName)) {
            showToast("You already have a pending join request!");
            return;
          }
          // Submit request
          setGuestRequests(prev => [
            ...prev,
            {
              id: `req_user_${Date.now()}`,
              userId: self.id,
              name: self.roomName,
              avatar: self.avatarUrl,
              isElite: joinContext.isElite,
            },
          ]);
          showToast("Join seat request sent! Waiting for Room Owner/Admin approval.");
          return;
        }
      }

      // Prompt helper to sit down!
      const userName = self.roomName;
      const isHost = seatKey === "host";
      const isCoOwnerSeat = seatKey === "coowner";
      const isAdminStaffSeat = seatKey === "admin";
      
      // Remove self from any other seat first
      const newSeats = { ...activeSeats };
      Object.keys(newSeats).forEach(k => {
        if (newSeats[k] && isRoomSelfGuest(newSeats[k], self)) {
          newSeats[k] = null;
        }
      });
      
      newSeats[seatKey] = createGuestFromSelf({
        userId: self.id,
        name: userName,
        avatar: self.avatarUrl,
        roomId: roomDisplayId,
        isHost,
        isCoOwner: isCoOwnerSeat,
        isAdminSeat: isAdminStaffSeat,
        isAdmin: isRoomAdminOrOwner(currentUserRole) || isCoOwnerSeat || isAdminStaffSeat,
      });
      
      setActiveSeats(newSeats);
      
      // Broadcast join message
      const joinText = isHost
        ? "took the Host seat!"
        : isCoOwnerSeat
          ? "took the Co-owner seat!"
          : isAdminStaffSeat
            ? "took the Boss seat!"
          : `took Seat ${seatKey.replace("no", "")}`;
      if (usesLivePartyFeed) {
        setLiveChatMsgs(prev => [...prev, { id: Date.now(), user: self.chatLabel, userId: self.id, text: joinText, isBurmese: false }]);
      } else {
        setMessages(prev => [...prev, { isSystem: false, user: self.chatLabel, text: joinText, isBurmese: false, isJoinEvent: false }]);
      }
      
      showToast("You are now seated!");
    } else {
      // Open action menu for occupied seat
      setSelectedSeatAction(seatKey);
    }
  };

  const handleFooterMyMicClick = () => {
    if (!userSeatKey) {
      setIsGuestManagementOpen(true);
      return;
    }
    handleToggleSeatMic(userSeatKey);
  };

  const handleFooterSeatManagementClick = () => {
    setIsGuestManagementOpen(true);
  };

  const handleLeaveRoom = useCallback(() => {
    cancelCurrentSong();

    const clearedSeats = clearSelfFromPartySeats(roomDisplayId, activeSeatsRef.current, self);
    setActiveSeats(clearedSeats);

    clearActiveRoomSession(roomDisplayId);
    exitRoomFlow();
  }, [exitRoomFlow, roomDisplayId, self]);

  useEffect(() => {
    return () => {
      clearSelfFromPartySeats(roomDisplayId, activeSeatsRef.current, self);
      clearActiveRoomSession(roomDisplayId);
    };
  }, [roomDisplayId, self.id, self.roomName]);

  const removeQueuedSong = useCallback((targetIndex: number) => {
    setSongQueue((prev) => {
      const target = prev[targetIndex];
      if (!target) return prev;
      const canRemove =
        isRoomAdminOrOwner(currentUserRole) ||
        (target.requestedByUserId
          ? target.requestedByUserId === self.id
          : isRoomSelfName(target.requestedBy, self));
      if (!canRemove) return prev;
      const next = prev.filter((_, idx) => idx !== targetIndex);
      showToast(`Removed "${target.title}" from queue.`);
      return next;
    });
  }, [currentUserRole, self]);

  const handleRemoveGuest = (seatKey: string) => {
    setActiveSeats(prev => ({
      ...prev,
      [seatKey]: null
    }));
  };

  const handleMuteGuest = (seatKey: string) => {
    setActiveSeats(prev => {
      const guest = prev[seatKey];
      if (!guest) return prev;
      return {
        ...prev,
        [seatKey]: {
          ...guest,
          isSpeaking: false
        }
      };
    });
  };

  // Base list of chat messages
  type RoomChatMessage = {
    isSystem: boolean;
    text: string;
    iconBadge?: string;
    user?: string;
    userId?: string;
    isJoinEvent?: boolean;
    isOwner?: boolean;
    isBurmese?: boolean;
  };

  const [messages, setMessages] = useState<RoomChatMessage[]>([
    { isSystem: true, text: "Seated automatically in this room", iconBadge: "speaker" },
    { isSystem: false, user: "Host", isOwner: true, text: "တိုထားဟူကပါ", isBurmese: true },
    { isSystem: false, user: "Host", isOwner: true, text: "မသံုးတာဟူကာလို့", isBurmese: true },
    { isSystem: false, user: "Host", isOwner: true, text: "ပံု/", isBurmese: true },
    { isSystem: false, user: "Host", isOwner: true, text: "ေရျမတက္ကသိုလ္ေရးသားသူတစ္ဦး", isBurmese: true }
  ]);

  useLayoutEffect(() => {
    if (!isFullPartyMode) {
      scrollChatToBottom();
    }
  }, [messages, isFullPartyMode, scrollChatToBottom]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    // Resume auto-scroll when user sends a message
    isAutoScrollEnabled.current = true;

    if (usesLivePartyFeed) {
      setLiveChatMsgs(prev => [
        ...prev,
        { id: Date.now(), user: self.chatLabel, userId: self.id, text: chatInput, isBurmese: false }
      ]);
    } else {
      setMessages(prev => [
        ...prev,
        { isSystem: false, user: self.chatLabel, userId: self.id, text: chatInput, isBurmese: false, isJoinEvent: false }
      ]);
    }
    setChatInput("");
    scrollChatToBottom({ force: true });
  };

  // Beautiful render helpers for high contrast frames
  const getAvatarFrameStyles = (style: string) => {
    switch (style) {
      case "cyan-crown":
        return {
          border: "border-2 border-cyan-400",
          shadow: "shadow-[0_0_15px_rgba(34,211,238,0.7)]",
          badgeBg: "bg-cyan-500",
          accentColor: "cyan"
        };
      case "gold":
        return {
          border: "border-2 border-yellow-400",
          shadow: "shadow-[0_0_15px_rgba(234,179,8,0.6)]",
          badgeBg: "bg-yellow-500",
          accentColor: "yellow"
        };
      case "blue-ice":
        return {
          border: "border-2 border-blue-400",
          shadow: "shadow-[0_0_15px_rgba(56,189,248,0.6)]",
          badgeBg: "bg-blue-500",
          accentColor: "blue"
        };
      case "shield-glow":
        return {
          border: "border-2 border-purple-400",
          shadow: "shadow-[0_0_15px_rgba(168,85,247,0.7)]",
          badgeBg: "bg-purple-500",
          accentColor: "purple"
        };
      case "gold-wings":
        return {
          border: "border-2 border-pink-500",
          shadow: "shadow-[0_0_15px_rgba(236,72,153,0.7)]",
          badgeBg: "bg-pink-500",
          accentColor: "pink"
        };
      case "purple-spiral":
        return {
          border: "border-2 border-indigo-400",
          shadow: "shadow-[0_0_12px_rgba(129,140,248,0.6)]",
          badgeBg: "bg-indigo-500",
          accentColor: "indigo"
        };
      case "neon-star":
        return {
          border: "border-2 border-emerald-400",
          shadow: "shadow-[0_0_15px_rgba(52,211,153,0.6)]",
          badgeBg: "bg-emerald-500",
          accentColor: "emerald"
        };
      case "flame-guitar":
        return {
          border: "border-2 border-red-500",
          shadow: "shadow-[0_0_18px_rgba(239,68,68,0.75)]",
          badgeBg: "bg-red-500",
          accentColor: "red"
        };
      default:
        return {
          border: "border-2 border-gray-400",
          shadow: "shadow-md",
          badgeBg: "bg-gray-500",
          accentColor: "gray"
        };
    }
  };

  const chorusPanelSongs = useMemo(
    () =>
      getChorusPanelSongs(chorusSongTab, {
        query: chorusSongSearch,
        similarToId: currentlySinging?.id ?? songQueue[0]?.id ?? null,
      }),
    [chorusSongTab, chorusSongSearch, currentlySinging?.id, songQueue, karaokeUploadsVersion],
  );

  if (roomIsPrivate && !hasPrivateKeyAccess) {
    return (
      <RoomKeyGate
        roomTitle={roomTitle}
        roomDisplayId={roomDisplayId}
        onSubmit={(enteredKey) => {
          if (!verifyRoomKey(liveSettings.roomKey, enteredKey)) {
            return false;
          }
          setHasPrivateKeyAccess(true);
          return true;
        }}
        onLeave={handleLeaveRoom}
      />
    );
  }

  return (
    <div className="room-shell flex flex-1 flex-col h-full min-h-0 max-h-full bg-[#07010a] text-gray-100 overflow-hidden relative font-sans select-none">
      {isUploadPerformance ? (
        <audio
          ref={uploadPerformancePlayback.audioRef}
          className="hidden"
          preload="metadata"
          playsInline
        />
      ) : null}

      {/* Absolute Layer Atmospheric Neon Mesh Background (Smoky club gold/magenta) */}
      <RoomBackgroundLayer mode={pendingBackgroundMode ?? backgroundMode} />

      <SongSelector 
        isOpen={isSongSelectorOpen} 
        onClose={() => setIsSongSelectorOpen(false)} 
        onSelectSong={handleRequestSong}
        songQueue={songQueue}
      />

      <LyricsOverlay 
        isOpen={isLyricsOverlayOpen} 
        song={currentlySinging} 
        onClose={cancelCurrentSong}
        onSing={beginSingingFromOverlay}
        isPerforming={isSelfPerforming}
        elapsedSec={performanceElapsedSec}
        progressPercent={chorusProgressPercent}
        micLevel={singingMicLevel}
        voiceStatus={singingVoiceStatus}
        voiceEffect={singingVoiceEffect}
        onVoiceEffectChange={setSingingVoiceEffect}
      />

      {/* Instructions Modal (Karaoke rules) */}
      {isInstructionsOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsInstructionsOpen(false)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[24px] w-full max-w-sm overflow-hidden z-10 shadow-2xl relative"
          >
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Instructions</h2>
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>1. The User who requests a song is called Lead;</p>
                <p>2. Other Users who request songs must be seated. When they are off the seats, their songs will be deleted automatically;</p>
                <p>3. Tap "Join Duet" and then you can join the duet of this song;</p>
                <p>4. The score of a single song is superimposed by the highest score of each sentence of the song;</p>
              </div>
              <button 
                onClick={() => setIsInstructionsOpen(false)}
                className="mt-8 w-full bg-[#ff3b70] hover:bg-[#ff3b70]/90 text-white font-bold py-3.5 rounded-full shadow-lg shadow-pink-200 transition-all active:scale-[0.98]"
              >
                OK
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Seat Action Bottom Sheet */}
      {selectedSeatAction && activeSeats[selectedSeatAction] && (() => {
        const seatKey = selectedSeatAction;
        const occupant = activeSeats[seatKey]!;
        const isSelfSeat = isRoomSelfGuest(occupant, self);
        const canManageMic = isSelfSeat || isRoomAdminOrOwner(currentUserRole);
        const canRemoveFromSeat =
          isSelfSeat || (isRoomAdminOrOwner(currentUserRole) && seatKey !== "host");
        const isFollowingOccupant =
          viewers.find((viewer) => viewer.name === occupant.name)?.isFollowing ?? false;

        return (
      <div 
        className="fixed inset-0 z-[150] transition-opacity duration-300 pointer-events-auto opacity-100"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSeatAction(null)} />
        <div className="absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-[#1a0f2e] rounded-t-3xl border-t border-purple-500/30 p-6 flex flex-col space-y-4 transition-transform duration-300 translate-y-0">
          <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-2 opacity-50" />
          
          <div className="flex items-center space-x-4 mb-4">
            <img 
              src={safeAvatarUrl(occupant.avatar)} 
              className="w-14 h-14 rounded-full border-2 border-purple-500/50 object-cover"
              alt="Profile"
            />
            <div>
              <h3 className="text-white font-bold text-lg">{occupant.name}</h3>
              <p className="text-purple-300 text-xs">
                {isSelfSeat ? 'Your seat' : formatSeatActionSubtitle(seatKey)}
              </p>
            </div>
          </div>

          <div className={`grid gap-3 text-sm ${canManageMic && !isSelfSeat ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {canManageMic ? (
            <button 
              onClick={() => {
                handleToggleSeatMic(seatKey);
                setSelectedSeatAction(null);
              }}
              className="bg-white/5 border border-white/10 hover:bg-white/10 py-3 rounded-xl flex items-center justify-center space-x-2 text-white font-medium transition cursor-pointer"
            >
              <Mic size={16} className={occupant.isSpeaking ? 'text-green-400' : 'text-red-400'} />
              <span>{occupant.isSpeaking ? 'Mute Mic' : 'Unmute Mic'}</span>
            </button>
            ) : null}
            {!isSelfSeat ? (
            <button 
              onClick={() => {
                handleToggleFollow(occupant.name);
                setSelectedSeatAction(null);
              }}
              className="bg-pink-500 hover:bg-pink-400 py-3 rounded-xl flex items-center justify-center space-x-2 text-white font-bold transition shadow-[0_0_15px_rgba(236,72,153,0.4)] cursor-pointer"
            >
              {isFollowingOccupant ? (
                <>
                  <UserMinus size={16} />
                  <span>Unfollow</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Follow</span>
                </>
              )}
            </button>
            ) : null}
          </div>

          <button 
            onClick={() => {
              handleSelectViewer({
                id: seatKey,
                name: occupant.name,
                avatar: occupant.avatar,
                isOwner: seatKey === "host",
                isAdmin: occupant.isAdmin || false,
                isFollowing: isFollowingOccupant,
              });
              setSelectedSeatAction(null);
            }}
            className="w-full bg-[#3b0764] hover:bg-[#581c87] border border-purple-500/30 text-purple-200 py-3 rounded-xl flex items-center justify-center space-x-2 font-bold transition cursor-pointer"
          >
            <User size={16} />
            <span>{isSelfSeat ? 'View My Profile' : 'Show Profile Preview'}</span>
          </button>

          {!isSelfSeat ? (
          <button 
            type="button"
            onClick={() => {
              const cleanName = occupant.name;
              setChatInput(prev => {
                if (prev.endsWith(" ") || prev === "") {
                  return `${prev}@${cleanName} `;
                }
                return `${prev} @${cleanName} `;
              });
              setSelectedSeatAction(null);
              showToast(`Added @${cleanName} mention to chat`);
            }}
            className="w-full bg-gradient-to-r from-[#FF3B70] to-[#b335ff] hover:opacity-90 text-white py-3 rounded-xl flex items-center justify-center space-x-2 font-extrabold tracking-wider transition cursor-pointer"
          >
            <span className="font-black text-yellow-300">@</span>
            <span>Mention in Chat</span>
          </button>
          ) : null}
          
          {canRemoveFromSeat ? (
          <button 
            onClick={() => {
              setActiveSeats(prev => ({ ...prev, [seatKey]: null }));
              showToast(
                isSelfSeat
                  ? 'You left your seat.'
                  : `Removed ${occupant.name} from ${
                      seatKey === "host"
                        ? "host seat"
                        : seatKey === "coowner"
                          ? "co-owner seat"
                          : seatKey === "admin"
                            ? "boss seat"
                          : "seat"
                    }`,
              );
              setSelectedSeatAction(null);
            }}
            className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 py-3 rounded-xl flex items-center justify-center space-x-2 text-red-400 font-medium transition mt-1 cursor-pointer"
          >
            <LogOut size={16} />
            <span>{isSelfSeat ? 'Leave Seat' : 'Remove from Seat'}</span>
          </button>
          ) : null}
        </div>
      </div>
        );
      })()}

      <GuestManagementOverlay
        isOpen={isGuestManagementOpen}
        onClose={() => setIsGuestManagementOpen(false)}
        activeSeats={activeSeats}
        onRemoveGuest={handleRemoveGuest}
        onMuteGuest={handleToggleSeatMic}
        guestRequests={guestRequests}
        onAcceptRequest={handleAcceptRequest}
        onDeclineRequest={handleDeclineRequest}
        currentUserRole={currentUserRole}
        isAllGuestMuted={isAllGuestMuted}
        onToggleAllMics={handleToggleAllMics}
        joinWithoutRequest={joinWithoutRequest}
        onToggleJoinMode={handleToggleJoinMode}
        lockedSeats={lockedSeats}
        onToggleSeatLock={handleToggleSeatLock}
        isUserSeated={isUserSeated}
        onJoinSeat={handleSeatClick}
        hasPendingJoinRequest={guestRequests.some((request) => request.name === self.roomName)}
        whoCanJoin={liveSettings.whoCanJoin}
        whoCanBeSeated={liveSettings.whoCanBeSeated}
        roomPriority={liveSettings.roomPriority}
        joinPolicySummary={joinPolicySummary}
        guestSeatKeys={roomLayoutConfig.guestSeatKeys}
      />

      <RoomViewersOverlay
        isOpen={isRoomViewersOpen}
        onClose={() => setIsRoomViewersOpen(false)}
        viewers={viewers}
        currentUserRole={currentUserRole}
        onToggleAdmin={handleToggleAdmin}
        onToggleCoOwner={handleToggleCoOwner}
        onToggleFollow={handleToggleFollow}
        onKickUser={handleKickUser}
        onSelectViewer={(viewer) => {
          handleSelectViewer(viewer);
          setIsRoomViewersOpen(false); // smoothly auto-close viewers overlay when profile pre-view is selected
        }}
      />

      <ArenaRankingsOverlay
        isOpen={isArenaRankingsOpen}
        onClose={() => setIsArenaRankingsOpen(false)}
        participants={arenaParticipants}
        onSendSupport={handleSendSupport}
        countdownText={formatCountdown(countdown)}
      />

      <RoomAnnouncementEditor
        open={isAnnouncementEditorOpen}
        onClose={() => setIsAnnouncementEditorOpen(false)}
        roomId={roomDisplayId}
        settings={liveSettings}
        onSaved={() => {
          refreshLiveSettings();
          showToast('Room announcement updated.');
        }}
      />

      <RoomModeSettingsSheet
        open={isRoomModePickerOpen}
        onClose={() => setIsRoomModePickerOpen(false)}
        roomMode={String(liveSettings.roomMode ?? 'Chat')}
        privacy={resolveRoomPrivacy(liveSettings)}
        roomKey={resolveRoomKey(liveSettings)}
        canManageRoomKey={canManageRoomKey}
        canSetPrivate={canManageRoomKey || resolveRoomPrivacy(liveSettings) === 'Private'}
        onSave={({ roomMode: nextMode, privacy: nextPrivacy, roomKey: nextRoomKey, publicKeyConfirm }) => {
          const previousKey = liveSettings.roomKey?.trim() ?? '';
          const wasPrivate = resolveRoomPrivacy(liveSettings) === 'Private';

          if (wasPrivate && nextPrivacy === 'Public' && previousKey) {
            if (!verifyRoomKey(previousKey, publicKeyConfirm ?? '')) {
              showToast('Confirm the room key before making this room public.');
              return;
            }
          }

          if (
            nextPrivacy === 'Private' &&
            nextRoomKey !== previousKey &&
            !canManageRoomKey
          ) {
            showToast('Only the room owner can change the room key while in the room.');
            return;
          }

          if (nextPrivacy === 'Private') {
            const validation = validateRoomKeyInput(nextRoomKey);
            if (!validation.valid) {
              showToast(validation.message ?? 'Enter a valid room key.');
              return;
            }
          }

          const patch = {
            roomMode: nextMode,
            ...roomPrivacyPatch(nextPrivacy, nextRoomKey),
          };
          const becamePrivate = nextPrivacy === 'Private' && !wasPrivate;
          const keyChanged =
            nextPrivacy === 'Private' &&
            Boolean(patch.roomKey) &&
            patch.roomKey !== previousKey;

          saveRoomSettings(roomDisplayId, patch);
          const managed = getManagedRoomById(roomDisplayId);
          if (managed) {
            syncManagedRoomFromActiveSession(roomDisplayId, managed.role, {
              roomMode: nextMode as RoomMode,
            });
          }
          refreshLiveSettings();
          const nextLayout = resolveRoomLayoutFromSettings(nextMode);
          setRoomMode(nextLayout.layout);
          setIsFullPartyMode(nextLayout.isFullPartyMode);
          savePartySeats(roomDisplayId, activeSeatsRef.current);

          if (nextPrivacy === 'Public') {
            setHasPrivateKeyAccess(true);
            showToast(`${formatRoomModeLabel(nextMode)} · Public room saved.`);
          } else if (nextPrivacy === 'Private') {
            if (becamePrivate || keyChanged) {
              setHasPrivateKeyAccess(false);
            }
            showToast(
              keyChanged
                ? 'Private room saved. Enter your new key to rejoin.'
                : 'Private room saved.',
            );
          }
        }}
      />

      {isRoomBackgroundMenuOpen && canChangeRoomBackground && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a0f2e] w-full max-w-sm rounded-[28px] border border-purple-500/30 p-6 shadow-2xl relative">
            <button 
               onClick={() => { setPendingBackgroundMode(null); setIsRoomBackgroundMenuOpen(false); }} 
               className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X />
            </button>
            <h2 className="text-white font-bold text-xl mb-6">Select Room Background</h2>
            
            {/* Background Preview */}
            <div className="relative w-full h-32 rounded-2xl mb-6 overflow-hidden border border-white/20 shadow-inner">
              <div className={`absolute inset-0 z-0 ${ (pendingBackgroundMode || backgroundMode).type === 'css' ? (pendingBackgroundMode || backgroundMode).value : ''}`}>
                {(pendingBackgroundMode || backgroundMode).type === 'video' && (
                  <video src={(pendingBackgroundMode || backgroundMode).value} autoPlay loop muted playsInline controls className="absolute inset-0 w-full h-full object-cover pointer-events-auto" {...nativeVideoControlGuardProps()} />
                )}
                {(pendingBackgroundMode || backgroundMode).type === 'image' && (
                  <div className="absolute inset-0 w-full h-full" style={{ backgroundImage: `url(${(pendingBackgroundMode || backgroundMode).value})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                )}
                <div className="absolute top-[10%] left-[50%] -translate-x-[50%] w-[100px] h-[100px] rounded-full bg-yellow-500/15 blur-[40px] pointer-events-none"></div>
                <div className="absolute bottom-[10%] left-[20%] w-[80px] h-[80px] rounded-full bg-pink-700/15 blur-[30px] pointer-events-none"></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {ROOM_BACKGROUND_PRESETS.map((bg) => (
                <button
                  key={bg.storageKey}
                  onClick={() => setPendingBackgroundMode({ type: bg.type, value: bg.value })}
                  className={`p-4 rounded-xl text-center border ${(pendingBackgroundMode || backgroundMode).value === bg.value ? "border-purple-500 bg-purple-900/40" : "border-white/10 bg-white/5"} transition hover:bg-white/10 text-white font-medium`}
                >
                  {bg.label}
                </button>
              ))}
              <label className="p-4 rounded-xl text-center border border-dashed border-white/20 bg-white/5 transition hover:bg-white/10 text-white font-medium cursor-pointer flex flex-col items-center">
                <span className="text-xs">Upload BG</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const result = reader.result;
                      if (typeof result !== 'string') return;
                      const type = file.type.startsWith('video/') ? 'video' : 'image';
                      setPendingBackgroundMode({ type, value: result });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setPendingBackgroundMode(null); setIsRoomBackgroundMenuOpen(false); }} className="flex-1 py-2 rounded-xl text-white font-medium border border-white/10 hover:bg-white/5">Cancel</button>
              <button onClick={() => {
                if (!canChangeRoomBackground) return;
                const next = pendingBackgroundMode ?? backgroundMode;
                setBackgroundMode(next);
                saveRoomSettings(roomDisplayId, {
                  background: serializeRoomBackground(next),
                });
                setPendingBackgroundMode(null);
                setIsRoomBackgroundMenuOpen(false);
              }} className="flex-1 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* LAYOUTS */}
      {roomMode === 'WatchTogether' && (
        <WatchTogetherView
          roomDisplayId={roomDisplayId}
          roomTitle={roomTitle}
          announcement={roomAnnouncement}
          isRoomSaved={isRoomSaved}
          roomIdCopied={roomIdCopied}
          onCopyRoomId={handleCopyRoomId}
          onToggleSaveRoom={handleToggleSaveRoom}
          watchTogetherMedia={watchTogetherMedia}
          roomSettings={liveSettings}
          viewerUserId={self.id}
          onLeaveRoom={handleLeaveRoom}
          onShareRoom={() => setIsShareRoomOpen(true)}
          onOpenRoomDetails={openRoomDetails}
          onOpenRoomEdit={openRoomEdit}
          activeSeats={activeSeats}
          viewers={viewers}
          roomExpProgress={roomExpProgress}
          roomGiftSummary={roomGiftSummary}
          handleSeatClick={handleSeatClick}
          handleToggleSeatMic={handleToggleSeatMic}
          buildViewerFromGuest={buildViewerFromGuest}
          handleSelectViewer={handleSelectViewer}
          setIsRoomBackgroundMenuOpen={(open) => {
            if (open) handleOpenRoomBackgroundMenu();
            else {
              setIsRoomBackgroundMenuOpen(false);
              setPendingBackgroundMode(null);
            }
          }}
          setIsRoomViewersOpen={setIsRoomViewersOpen}
          setIsGiftPickerOpen={setIsGiftPickerOpen}
          setIsGuestManagementOpen={setIsGuestManagementOpen}
          liveChatMsgs={liveChatMsgs}
          chatInput={chatInput}
          handleChatInputChange={handleChatInputChange}
          handleSendMessage={handleSendMessage}
          handleChatScroll={handleChatScroll}
          chatScrollRef={chatScrollRef}
          getMentionSuggestions={getMentionSuggestions}
          selectMention={selectMention}
          mutuallyFollowing={mutuallyFollowing}
          toggleHeartbeat={toggleHeartbeat}
          renderJoinChatEvent={renderJoinChatEvent}
          renderSingChatEvent={renderSingChatEvent}
          renderGiftChatEvent={renderGiftChatEvent}
          renderStandardChatMessage={renderStandardChatMessage}
          mentionSearch={mentionSearch}
          onToggleUserMic={handleFooterMyMicClick}
          userSeatKey={userSeatKey}
          userMicOn={userMicOn}
          userVoiceActive={userVoiceActive}
          userMicLevel={userMicLevel}
          audioPulse={audioPulse}
          canChangeRoomBackground={canChangeRoomBackground}
          backgroundMode={backgroundMode}
          pendingBackgroundMode={pendingBackgroundMode}
          arenaParticipants={arenaParticipants}
          arenaCountdownText={formatCountdown(countdown)}
          onOpenArenaRankings={() => setIsArenaRankingsOpen(true)}
          lockedSeats={lockedSeats}
          canManageMedia={isRoomAdminOrOwner(currentUserRole)}
          showToast={showToast}
          canEditAnnouncement={canEditRoomAnnouncement}
          onEditAnnouncement={handleOpenAnnouncementEditor}
          canChangeRoomMode={canEditRoomAnnouncement}
          onOpenRoomModePicker={handleOpenRoomModePicker}
        />
      )}

      {roomMode === 'Chorus' && (
        <div className="relative z-10 flex-1 flex flex-col min-h-0 w-full overflow-hidden animate-fade-in">
            <div className="chorus-room-stage room-stage flex flex-col shrink-0 min-h-0 overflow-hidden">
            {/* TOP HEADER — same save/level chrome as Party & Watch Together */}
            <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 px-3 sm:px-4 pt-2 sm:pt-3 pb-1.5">
                <RoomLiveHeaderInfo
                  roomLevel={roomExpProgress.level}
                  roomTitle={roomTitle}
                  announcement={roomAnnouncement}
                  roomDisplayId={roomDisplayId}
                  isRoomSaved={isRoomSaved}
                  roomIdCopied={roomIdCopied}
                  onOpenDetails={openRoomDetails}
                  onCopyRoomId={handleCopyRoomId}
                  onToggleSaveRoom={handleToggleSaveRoom}
                  canEditAnnouncement={canEditRoomAnnouncement}
                  onEditAnnouncement={handleOpenAnnouncementEditor}
                />

                <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
                    <div 
                      onClick={() => setIsRoomViewersOpen(true)}
                      className="party-viewers-chip party-glass-chip flex min-h-[32px] items-center space-x-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full cursor-pointer transition group shrink-0"
                    >
                        <div className="flex -space-x-2 mr-0.5">
                          {viewers.slice(0, 3).map(v => (
                            <img 
                              key={v.id} 
                              src={safeAvatarUrl(v.avatar)} 
                              className="rounded-full border-2 border-[#07010a] object-cover" 
                              alt="" 
                            />
                          ))}
                        </div>
                        <div className="flex items-center space-x-1.5 opacity-90 group-hover:opacity-100">
                          <Users size={16} className="text-gray-300 sm:w-[18px] sm:h-[18px]" />
                          <span className="party-viewers-count font-black text-gray-100">{viewers.length}</span>
                        </div>
                    </div>
                    <RoomHeaderActionsMenu items={chorusHeaderMenuItems} />
                    <button
                      type="button"
                      onClick={handleLeaveRoom}
                      title="Exit room"
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/30 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 flex items-center justify-center text-gray-300 hover:text-red-200 active:scale-90 transition"
                      aria-label="Exit room"
                    >
                      <LogOut size={15} />
                    </button>
                </div>
            </div>

            <div className="relative z-20 flex shrink-0 items-center gap-2 px-3 sm:px-4 py-0.5 min-h-0">
              <div className="flex min-w-0 flex-1 items-center space-x-1.5 overflow-x-auto sm:space-x-2 scrollbar-hide">
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
                <div
                  className="backdrop-blur rounded-full px-2 py-0.5 text-[8.5px] font-bold text-teal-400 flex items-center cursor-pointer hover:bg-purple-950/20 active:scale-95 transition shrink-0"
                  onClick={openRoomDetails}
                  title={`Today ${roomExpProgress.todayExp}/${roomExpProgress.dailyCap} EXP`}
                >
                  <span>
                    EXP {roomExpProgress.todayExp}/{roomExpProgress.dailyCap}
                    {roomExpProgress.todayOverDailyTarget ? '+' : ''}
                  </span>
                  <ChevronRight size={8} className="ml-0.5 text-teal-500" />
                </div>
                <div
                  className="bg-[#240c1e]/80 backdrop-blur border border-pink-500/20 rounded-full px-2 py-0.5 text-[8.5px] font-bold text-pink-400 flex items-center cursor-pointer hover:bg-pink-950/20 active:scale-95 transition shrink-0"
                  onClick={() => setIsGiftPickerOpen(true)}
                  title={`${roomGiftSummary.giftCount.toLocaleString()} gifts received in this room`}
                >
                  <Star size={8} className="fill-pink-400 text-pink-400 mr-0.5" />
                  <span>{roomGiftSummary.totalStars.toLocaleString()}</span>
                  <ChevronRight size={8} className="ml-0.5 text-pink-400" />
                </div>
              </div>
            </div>

            {/* Singing Stage or Song Selection Panel Overlay */}
            {isSingingMode && currentlySinging ? (
              <ChorusPerformanceStage
                song={currentlySinging}
                singerLabel={
                  currentSingerName
                    ? formatRoomSelfLabel(currentSingerName, self)
                    : 'Singer'
                }
                elapsedSec={performanceElapsedSec}
                elapsedLabel={chorusElapsedLabel}
                totalLabel={chorusTotalLabel}
                progressPercent={chorusProgressPercent}
                chorusScore={chorusScore}
                audioPulse={audioPulse}
                micLevel={singingMicLevel}
                voiceStatus={singingVoiceStatus}
                isSelfPerforming={isSelfPerforming}
                voiceEffect={singingVoiceEffect}
                onVoiceEffectChange={setSingingVoiceEffect}
                onOpenQueue={() => setIsQueueSheetOpen(true)}
                onCancel={cancelCurrentSong}
              />
            ) : (
              <div className="mx-3 sm:mx-4 mt-2 shrink-0 bg-purple-900/20 backdrop-blur-md rounded-[28px] border border-white/5 flex flex-col overflow-hidden max-h-[min(240px,30vh)] sm:max-h-[min(320px,36vh)]">
                  <div className="px-5 py-3 flex items-center space-x-4">
                      <label className="flex-1 bg-white/10 rounded-full h-8 flex items-center px-4 min-w-0">
                          <Search size={14} className="text-gray-400 shrink-0" />
                          <input
                            type="search"
                            value={chorusSongSearch}
                            onChange={(event) => setChorusSongSearch(event.target.value)}
                            placeholder="Search songs or artists"
                            className="ml-2 text-xs bg-transparent border-none outline-none flex-1 min-w-0 text-gray-200 placeholder:text-gray-400"
                          />
                      </label>
                      <div className="flex items-center space-x-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsArenaRankingsOpen(true)}
                            title="Arena activity"
                            className="text-pink-500 hover:text-pink-300 transition"
                            aria-label="Open arena activity"
                          >
                            <Activity size={18} />
                          </button>
                          <HelpCircle 
                            size={18} 
                            className="text-gray-400 cursor-pointer hover:text-white transition" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsInstructionsOpen(true);
                            }}
                          />
                      </div>
                  </div>
                  <div className="px-5 flex items-center space-x-6 overflow-x-auto scrollbar-hide border-b border-white/5 pb-2">
                      {CHORUS_SONG_TABS.map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setChorusSongTab(tab.id)}
                            className={`text-[11px] font-black whitespace-nowrap transition ${
                              chorusSongTab === tab.id
                                ? 'text-white border-b-2 border-pink-500 pb-1'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {tab.label}
                          </button>
                      ))}
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-hide">
                      {chorusPanelSongs.length === 0 ? (
                        <p className="text-center text-xs text-gray-500 py-6">
                          No songs match your search. Try another tab or keyword.
                        </p>
                      ) : (
                        chorusPanelSongs.map((song) => (
                          <div key={song.id} className="flex items-center justify-between gap-3">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <img src={song.image} className="w-11 h-11 rounded-lg object-cover shrink-0" alt="" />
                                  <div className="flex-1 min-w-0">
                                      <h4 className="text-[13px] font-black text-white truncate">{song.title}</h4>
                                      <p className="text-[10px] text-gray-400 truncate">
                                        {song.artist}
                                        {isKaraokeUploadSongId(song.id) ? ' • Your upload' : ''}
                                      </p>
                                  </div>
                              </div>
                              <button 
                                type="button"
                                onClick={() => handleRequestSong(song)} 
                                disabled={!isUserSeated}
                                title={
                                  isUserSeated
                                    ? isStageActive
                                      ? `Join duet for ${song.title}`
                                      : `Sing ${song.title}`
                                    : 'Take a seat to sing'
                                }
                                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-black px-6 py-1.5 rounded-full uppercase transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {isStageActive ? 'Join Duet' : 'SING'}
                              </button>
                          </div>
                        ))
                      )}
                  </div>
              </div>
            )}

            <div className="chorus-seat-grid shrink-0 px-3 sm:px-4 py-3 sm:py-4">
                {chorusSeatRows.map((rowKeys, rowIndex) => (
                  <div key={rowKeys.join('-')} className="chorus-seat-row">
                    {rowKeys.map((key) => {
                    const guest = activeSeats[key];
                    const sNum = formatGuestSeatNumber(key);
                    const isLeadSeat = key === 'no1';
                    return (
                        <div key={key} className="flex flex-col items-center min-w-0">
                            <button 
                              type="button"
                              onClick={() => handleSeatClick(key)} 
                              className={`chorus-guest-seat relative flex flex-col items-center rounded-full transition-all duration-200 ${
                                guest 
                                  ? `p-[1.5px] ${getAvatarFrameStyles(guest.frameStyle).border} ${getAvatarFrameStyles(guest.frameStyle).shadow}` 
                                  : "bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:border-pink-500/50"
                              }`}
                            >
                                {guest ? (
                                    <div className="w-full h-full rounded-full overflow-hidden border border-black/50">
                                        <img src={safeAvatarUrl(guest.avatar)} className="w-full h-full object-cover" alt={guest.name} />
                                    </div>
                                ) : (
                                    <Sofa size={rowIndex === 0 ? 18 : 16} />
                                )}
                                
                                {isLeadSeat && (
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[7px] font-black px-1 rounded-sm uppercase tracking-tighter leading-none py-0.5 border border-red-400 z-10 whitespace-nowrap shadow-sm">
                                     Lead
                                  </div>
                                )}
                                
                                {guest?.isSpeaking && (
                                    <div className="absolute inset-0 rounded-full border-2 border-[#02faab] animate-pulse pointer-events-none shadow-[0_0_8px_rgba(2,250,171,0.5)]"></div>
                                )}

                                {lockedSeats[key] && !guest && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                                        <Lock size={12} className="text-red-500" />
                                    </div>
                                )}
                            </button>
                            <span className="party-guest-seat-number text-[8px] font-black mt-1.5 uppercase tracking-tighter">NO.{sNum}</span>
                        </div>
                    );
                    })}
                  </div>
                ))}
            </div>
            </div>

            {/* Chat Feed — flex between seats and footer */}
            <div
              id="chat_and_action_container"
              className="party-chat-grid room-conversation flex flex-1 min-h-0 overflow-hidden px-3 sm:px-4 mt-2"
            >
                <div id="chat-feed-module" className="flex flex-1 min-h-0 min-w-0 flex-col justify-end overflow-hidden">
                    <div
                      className="flex-1 min-h-0 overflow-y-auto space-y-4 scrollbar-hide"
                      ref={chatScrollRef}
                      onScroll={handleChatScroll}
                    >
                        <div className="space-y-4" ref={chatMessagesRef}>
                            {liveChatMsgs.map((m) => {
                              if (m.isAnnouncementWelcome) {
                                return renderAnnouncementWelcome(m);
                              }
                              if (m.isSingEvent) {
                                return renderSingChatEvent(m);
                              }
                              if (m.isJoinEvent) {
                                return renderJoinChatEvent(m);
                              }
                              if (m.isGiftEvent) {
                                return renderGiftChatEvent(m);
                              }
                              return renderStandardChatMessage(m, {
                                bubbleClassName: 'bg-purple-900/30 backdrop-blur-md border border-white/5',
                              });
                            })}
                        </div>
                        <div ref={chatEndRef} aria-hidden="true" className="h-px w-full shrink-0" />
                    </div>
                </div>
                <RoomArenaColumn
                  participants={arenaParticipants}
                  countdownText={formatCountdown(countdown)}
                  onOpen={() => setIsArenaRankingsOpen(true)}
                />
            </div>
        </div>
      )}

      {roomMode === 'Party' && (
        <div className="party-room-layout flex flex-1 min-h-0 flex-col w-full overflow-hidden">
          {/* Party Header (Original) */}
          <div className="relative z-20 flex justify-between items-center gap-2 px-3 sm:px-4 pt-3 sm:pt-4 pb-1.5 sm:pb-2 bg-transparent shrink-0">
             <RoomLiveHeaderInfo
               roomLevel={roomExpProgress.level}
               roomTitle={roomTitle}
               announcement={roomAnnouncement}
               roomDisplayId={roomDisplayId}
               isRoomSaved={isRoomSaved}
               roomIdCopied={roomIdCopied}
               onOpenDetails={openRoomDetails}
               onCopyRoomId={handleCopyRoomId}
               onToggleSaveRoom={handleToggleSaveRoom}
               canEditAnnouncement={canEditRoomAnnouncement}
               onEditAnnouncement={handleOpenAnnouncementEditor}
             />
             <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
                <div 
                  onClick={() => setIsRoomViewersOpen(true)} 
                  className="party-viewers-chip party-glass-chip flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full cursor-pointer transition group"
                >
                    <div className="flex -space-x-2 mr-0.5">
                      {viewers.slice(0, 3).map(v => (
                        <img 
                          key={v.id} 
                          src={safeAvatarUrl(v.avatar)} 
                          className="rounded-full border-2 border-[#07010a] object-cover" 
                          alt="" 
                        />
                      ))}
                    </div>
                    <div className="flex items-center space-x-1.5 opacity-90 group-hover:opacity-100">
                      <Users size={16} className="text-gray-300 sm:w-[18px] sm:h-[18px]" />
                      <span className="party-viewers-count font-black text-gray-100">{viewers.length}</span>
                    </div>
                </div>
                <RoomHeaderActionsMenu items={partyHeaderMenuItems} />
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  title="Leave room"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/30 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 flex items-center justify-center text-gray-300 hover:text-red-200 active:scale-90 transition"
                  aria-label="Leave room"
                >
                  <LogOut size={15} />
                </button>
             </div>
          </div>

          <div className="relative z-20 flex items-center gap-2 px-3 sm:px-4 py-0.5 shrink-0 min-h-0">
            <div className="flex min-w-0 flex-1 items-center space-x-1.5 overflow-x-auto sm:space-x-2 scrollbar-hide">
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
              <div
                className="backdrop-blur rounded-full px-2 py-0.5 text-[8.5px] font-bold text-teal-400 flex items-center cursor-pointer hover:bg-purple-950/20 active:scale-95 transition shrink-0"
                onClick={openRoomDetails}
                title={
                  roomExpProgress.todayOverDailyTarget
                    ? `Today ${roomExpProgress.todayExp}/${roomExpProgress.dailyCap} (+${roomExpProgress.todayBonusExp} bonus from gifts) · Empty ${roomExpProgress.todayEmptyRoomFreeExp}/${roomExpProgress.dailyEmptyRoomFreeCap} · Seated ${roomExpProgress.todaySeatedFreeExp}/${roomExpProgress.dailySeatedFreeCap} · Gold ${roomExpProgress.todayGoldExp}/${roomExpProgress.dailyGoldCap}`
                    : `Today ${roomExpProgress.todayExp}/${roomExpProgress.dailyCap} · Empty ${roomExpProgress.todayEmptyRoomFreeExp}/${roomExpProgress.dailyEmptyRoomFreeCap} · Seated ${roomExpProgress.todaySeatedFreeExp}/${roomExpProgress.dailySeatedFreeCap} · Gold ${roomExpProgress.todayGoldExp}/${roomExpProgress.dailyGoldCap} · 1 EXP/s`
                }
              >
                <span>
                  EXP {roomExpProgress.todayExp}/{roomExpProgress.dailyCap}
                  {roomExpProgress.todayOverDailyTarget ? '+' : ''}
                </span>
                <ChevronRight size={8} className="ml-0.5 text-teal-500" />
              </div>
              <div
                className="bg-[#240c1e]/80 backdrop-blur border border-pink-500/20 rounded-full px-2 py-0.5 text-[8.5px] font-bold text-pink-400 flex items-center cursor-pointer hover:bg-pink-950/20 active:scale-95 transition shrink-0"
                onClick={() => setIsGiftPickerOpen(true)}
                title={`${roomGiftSummary.giftCount.toLocaleString()} gifts received in this room`}
              >
                <Star size={8} className="fill-pink-400 text-pink-400 mr-0.5" />
                <span>{roomGiftSummary.totalStars.toLocaleString()}</span>
                <ChevronRight size={8} className="ml-0.5 text-pink-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 flex-col w-full overflow-hidden">
          {(songQueue.length > 0 || (isStageActive && currentSingerName === self.roomName)) && (
            <div className="relative z-20 mx-4 mb-1 px-1 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-wider">
                  {songQueue.length > 0 ? `Up next (${songQueue.length})` : "Now performing"}
                </p>
                {isStageActive && currentSingerName === self.roomName && (
                  <button
                    type="button"
                    onClick={() => setIsQueueSheetOpen(true)}
                    className="text-[8.5px] font-bold text-[#d946ef] uppercase tracking-wider hover:text-pink-300 transition"
                  >
                    Queue
                  </button>
                )}
              </div>
              {songQueue.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                {songQueue.slice(0, 6).map((queuedSong, index) => (
                  <div
                    key={queuedSong.id}
                    className="shrink-0 bg-black/40 border border-white/10 rounded-lg px-2 py-1 max-w-[140px]"
                  >
                    <span className="text-[8px] text-purple-400 font-black">#{index + 1}</span>
                    <span className="text-[9px] text-gray-200 font-bold ml-1 truncate inline-block align-middle max-w-[100px]">
                      {queuedSong.title}
                    </span>
                    {queuedSong.requestedBy === self.roomName && (
                      <span className="block text-[7px] text-pink-400/80 font-bold mt-0.5">Your pick</span>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          <div
            className="party-seats-stage relative z-10 shrink-0 w-full flex flex-col items-center px-2 sm:px-4 py-1 sm:py-2 overflow-hidden"
            id="party-room-body"
          >
        
        {/* Host + co-owner staff seats (top center) */}
        <div className="party-host-seat-row relative z-10">
        <div className="party-host-seat-block flex flex-col items-center" id="host-seat-island">
          {activeSeats.host ? (
            // Seated Host
            <div className="party-staff-seat-cell">
              <div 
                onClick={() => handleSeatClick("host")}
                className="relative overflow-visible cursor-pointer transition transform hover:scale-105"
              >
                <SeatSpeakingLevelBars
                  active={isSeatVoiceVisualActive(activeSeats.host, 'host')}
                  audioPulse={seatVoicePulse('host')}
                />
                {/* Profile Avatar Frame */}
                <div className="party-host-avatar relative rounded-full p-[2px] bg-gradient-to-tr from-cyan-400 via-purple-600 to-pink-500 shadow-[0_0_12px_rgba(34,211,238,0.4)]">
                  <img 
                    src={safeAvatarUrl(activeSeats.host.avatar)} 
                    className="w-full h-full rounded-full object-cover border-2 border-[#07010a]" 
                    alt="Host avatar" 
                  />
                </div>
                <SeatVoiceGlowEffect
                  active={isSeatVoiceVisualActive(activeSeats.host, 'host')}
                  audioPulse={seatVoicePulse('host')}
                />
                {/* Active microphone / music speaking badge */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSeatMic("host");
                  }}
                  className={`absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 rounded-full p-0.5 sm:p-1 border border-[#07010a] cursor-pointer z-30 transition duration-150 transform active:scale-95 hover:scale-110 ${
                    activeSeats.host.isSpeaking 
                      ? "bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" 
                      : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                  }`}
                  title={activeSeats.host.isSpeaking ? "Mute Host Microphone" : "Unmute Host Microphone"}
                >
                  {activeSeats.host.isSpeaking ? (
                    <Mic size={10} className="text-white sm:w-3 sm:h-3" />
                  ) : (
                    <MicOff size={10} className="text-white sm:w-3 sm:h-3" strokeWidth={3} />
                  )}
                </div>
              </div>
              <span 
                onClick={() => handleSelectViewer(buildViewerFromGuest(activeSeats.host!, "host"))}
                className="party-host-name font-black text-cyan-300 mt-1.5 sm:mt-2 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] cursor-pointer hover:underline hover:text-cyan-100 transition tracking-wide text-center"
                id="host-profile-preview-trigger"
              >
                {activeSeats.host.name}
              </span>
              {/* Star Badge Rating */}
              <div className="flex items-center space-x-0.5 bg-cyan-950/80 px-1.5 py-[2px] rounded-full border border-cyan-400/40 mt-1 shadow-sm shadow-cyan-950/50">
                <Star size={8} className="fill-yellow-400 text-yellow-400 sm:w-[9px] sm:h-[9px]" />
                <span className="text-[8px] sm:text-[9.5px] font-black text-yellow-300 font-mono leading-none">{activeSeats.host.stars}</span>
              </div>
            </div>
          ) : (
            // Empty Host Seat
            <div className="party-staff-seat-cell">
              <button 
                onClick={() => handleSeatClick("host")}
                className="party-empty-seat party-glass-tap rounded-full hover:border-[#FF3B70]/50 flex items-center justify-center transform active:scale-95 cursor-pointer"
              >
                <User size={18} className="sm:w-6 sm:h-6" />
              </button>
              <span className="party-staff-seat-label text-[10px] sm:text-xs font-bold mt-1.5 sm:mt-2 tracking-wide uppercase">Host</span>
            </div>
          )}
        </div>

        <div className="party-coowner-seat-block flex flex-col items-center" id="coowner-seat-island">
          {activeSeats.coowner ? (
            <div className="party-staff-seat-cell">
              <div
                onClick={() => handleSeatClick("coowner")}
                className="relative overflow-visible cursor-pointer transition transform hover:scale-105"
              >
                <SeatSpeakingLevelBars
                  active={isSeatVoiceVisualActive(activeSeats.coowner, 'coowner')}
                  audioPulse={seatVoicePulse('coowner')}
                />
                <div className="party-coowner-avatar relative rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-orange-500 to-yellow-500 shadow-[0_0_12px_rgba(251,191,36,0.45)]">
                  <img
                    src={safeAvatarUrl(activeSeats.coowner.avatar)}
                    className="w-full h-full rounded-full object-cover border-2 border-[#07010a]"
                    alt="Co-owner avatar"
                  />
                </div>
                <SeatVoiceGlowEffect
                  active={isSeatVoiceVisualActive(activeSeats.coowner, 'coowner')}
                  audioPulse={seatVoicePulse('coowner')}
                  variant="pink"
                />
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSeatMic("coowner");
                  }}
                  className={`absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 rounded-full p-0.5 sm:p-1 border border-[#07010a] cursor-pointer z-30 transition duration-150 transform active:scale-95 hover:scale-110 ${
                    activeSeats.coowner.isSpeaking
                      ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                      : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                  }`}
                  title={activeSeats.coowner.isSpeaking ? "Mute Co-owner Microphone" : "Unmute Co-owner Microphone"}
                >
                  {activeSeats.coowner.isSpeaking ? (
                    <Mic size={10} className="text-white sm:w-3 sm:h-3" />
                  ) : (
                    <MicOff size={10} className="text-white sm:w-3 sm:h-3" strokeWidth={3} />
                  )}
                </div>
              </div>
              <span
                onClick={() => handleSelectViewer(buildViewerFromGuest(activeSeats.coowner!, "coowner"))}
                className="party-coowner-name font-black text-amber-300 mt-1.5 sm:mt-2 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] cursor-pointer hover:underline hover:text-amber-100 transition tracking-wide text-center"
              >
                {activeSeats.coowner.name}
              </span>
              <div className="flex items-center space-x-0.5 bg-amber-950/80 px-1.5 py-[2px] rounded-full border border-amber-400/40 mt-1 shadow-sm shadow-amber-950/50">
                <Star size={8} className="fill-yellow-400 text-yellow-400 sm:w-[9px] sm:h-[9px]" />
                <span className="text-[8px] sm:text-[9.5px] font-black text-yellow-300 font-mono leading-none">{activeSeats.coowner.stars}</span>
              </div>
            </div>
          ) : (
            <div className="party-staff-seat-cell">
              <button
                onClick={() => handleSeatClick("coowner")}
                className="party-empty-seat party-glass-tap rounded-full hover:border-amber-400/50 flex items-center justify-center transform active:scale-95 cursor-pointer"
              >
                <User size={18} className="sm:w-6 sm:h-6" />
              </button>
              <span className="party-staff-seat-label text-[10px] sm:text-xs font-bold mt-1.5 sm:mt-2 tracking-wide uppercase">Co-owner</span>
            </div>
          )}
        </div>
        {!isFullPartyMode ? (
        <div className="party-admin-seat-block flex flex-col items-center" id="admin-seat-island">
          {activeSeats.admin ? (
            <div className="party-staff-seat-cell">
              <div
                onClick={() => handleSeatClick("admin")}
                className="relative overflow-visible cursor-pointer transition transform hover:scale-105"
              >
                <SeatSpeakingLevelBars
                  active={isSeatVoiceVisualActive(activeSeats.admin, 'admin')}
                  audioPulse={seatVoicePulse('admin')}
                />
                <div className="party-admin-avatar relative rounded-full p-[2px] bg-gradient-to-tr from-violet-400 via-purple-500 to-fuchsia-500 shadow-[0_0_12px_rgba(168,85,247,0.45)]">
                  <img
                    src={safeAvatarUrl(activeSeats.admin.avatar)}
                    className="w-full h-full rounded-full object-cover border-2 border-[#07010a]"
                    alt="Boss avatar"
                  />
                </div>
                <SeatVoiceGlowEffect
                  active={isSeatVoiceVisualActive(activeSeats.admin, 'admin')}
                  audioPulse={seatVoicePulse('admin')}
                  variant="pink"
                />
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSeatMic("admin");
                  }}
                  className={`absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 rounded-full p-0.5 sm:p-1 border border-[#07010a] cursor-pointer z-30 transition duration-150 transform active:scale-95 hover:scale-110 ${
                    activeSeats.admin.isSpeaking
                      ? "bg-violet-500 animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                      : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                  }`}
                  title={activeSeats.admin.isSpeaking ? "Mute Boss Microphone" : "Unmute Boss Microphone"}
                >
                  {activeSeats.admin.isSpeaking ? (
                    <Mic size={10} className="text-white sm:w-3 sm:h-3" />
                  ) : (
                    <MicOff size={10} className="text-white sm:w-3 sm:h-3" strokeWidth={3} />
                  )}
                </div>
              </div>
              <span
                onClick={() => handleSelectViewer(buildViewerFromGuest(activeSeats.admin!, "admin"))}
                className="party-admin-name font-black text-violet-300 mt-1.5 sm:mt-2 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] cursor-pointer hover:underline hover:text-violet-100 transition tracking-wide text-center"
              >
                {activeSeats.admin.name}
              </span>
              <div className="flex items-center space-x-0.5 bg-violet-950/80 px-1.5 py-[2px] rounded-full border border-violet-400/40 mt-1 shadow-sm shadow-violet-950/50">
                <Star size={8} className="fill-yellow-400 text-yellow-400 sm:w-[9px] sm:h-[9px]" />
                <span className="text-[8px] sm:text-[9.5px] font-black text-yellow-300 font-mono leading-none">{activeSeats.admin.stars}</span>
              </div>
            </div>
          ) : (
            <div className="party-staff-seat-cell">
              <button
                onClick={() => handleSeatClick("admin")}
                className="party-empty-seat party-glass-tap rounded-full hover:border-violet-400/50 flex items-center justify-center transform active:scale-95 cursor-pointer"
              >
                <User size={18} className="sm:w-6 sm:h-6" />
              </button>
              <span className="party-staff-seat-label text-[10px] sm:text-xs font-bold mt-1.5 sm:mt-2 tracking-wide uppercase">
                {formatStaffSeatLabel('admin')}
              </span>
            </div>
          )}
        </div>
        ) : null}
        </div>

        {/* Guest seat grids — row count follows saved room mode */}
        <div className="w-full max-w-full px-1 sm:px-2 relative" id="guest-seats-grid-parent">
          

          {/* Seat Rows wrapper */}
          <div className="party-guest-seat-rows relative z-10">
            {partyGuestSeatRows.map((rowKeys, rowIndex) => (
            <div key={rowKeys.join('-')} className="party-seat-grid">
              {isFullPartyMode && rowIndex === 0 ? (
                <SeatHeartbeatRowOverlay
                  segments={PARTY_HEARTBEAT_ROW1}
                  mutuallyFollowing={mutuallyFollowing}
                  activeSeats={activeSeats}
                  onToggle={toggleHeartbeat}
                />
              ) : null}
              {isFullPartyMode && rowIndex === 1 ? (
                <SeatHeartbeatRowOverlay
                  segments={PARTY_HEARTBEAT_ROW2}
                  mutuallyFollowing={mutuallyFollowing}
                  activeSeats={activeSeats}
                  onToggle={toggleHeartbeat}
                />
              ) : null}
              {rowKeys.map((key) => {
                const sNum = formatGuestSeatNumber(key);
                const seatValue = activeSeats[key];
                const micActiveClass = rowIndex === 0
                  ? 'bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.6)]'
                  : 'bg-[#02faab] shadow-[0_0_6px_rgba(2,250,171,0.6)]';
                return (
                  <div key={key} className="relative z-10 flex flex-col items-center">
                    {seatValue ? (
                      /* Occupied Seat */
                      <div className="flex flex-col items-center w-full">
                        {/* Singing EQ bars */}
                        {isSeatCurrentlySinging(seatValue.name) && (
                          <div className="absolute -top-1.5 sm:-top-2 left-0 right-0 flex justify-center space-x-0.5 pointer-events-none">
                            <span className="w-0.5 bg-[#FF3B70] rounded-full animate-bounce" style={{ height: `${8 + (audioPulse % 6)}px`, animationDelay: '0.1s' }}></span>
                            <span className="w-0.5 bg-pink-400 rounded-full animate-bounce" style={{ height: `${4 + (audioPulse % 10)}px`, animationDelay: '0.3s' }}></span>
                            <span className="w-0.5 bg-[#02faab] rounded-full animate-bounce" style={{ height: `${10 + (audioPulse % 5)}px`, animationDelay: '0.2s' }}></span>
                          </div>
                        )}
                        {/* Voice activity bars while mic is live (not performing) */}
                        {/* Avatar + mic badge (mic anchored to avatar like host seat) */}
                        <div className="relative overflow-visible">
                          <SeatSpeakingLevelBars
                            active={isSeatVoiceVisualActive(seatValue, key)}
                            audioPulse={seatVoicePulse(key)}
                          />
                          <div 
                            onClick={() => handleSeatClick(key)}
                            className={`party-guest-avatar relative rounded-full p-[2px] cursor-pointer hover:scale-105 transition-transform ${getAvatarFrameStyles(seatValue.frameStyle).border} ${getAvatarFrameStyles(seatValue.frameStyle).shadow}`}
                          >
                            <img 
                              src={safeAvatarUrl(seatValue.avatar)} 
                              className="w-full h-full rounded-full object-cover border-2 border-black" 
                              alt={seatValue.name} 
                            />
                          </div>
                          <SeatVoiceGlowEffect
                            active={isSeatVoiceVisualActive(seatValue, key)}
                            audioPulse={seatVoicePulse(key)}
                            variant="pink"
                          />

                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSeatMic(key);
                            }}
                            className={`absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 rounded-full p-[3px] sm:p-1 border border-[#0d011c] cursor-pointer z-30 transition duration-150 transform hover:scale-110 active:scale-95 ${
                              seatValue.isSpeaking 
                                ? micActiveClass
                                : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                            }`}
                            title={seatValue.isSpeaking ? `Mute ${seatValue.name}` : `Unmute ${seatValue.name}`}
                          >
                            {seatValue.isSpeaking ? (
                              <Mic size={8} className="text-white sm:w-[9px] sm:h-[9px]" />
                            ) : (
                              <MicOff size={8} className="text-white sm:w-[9px] sm:h-[9px]" strokeWidth={3} />
                            )}
                          </div>
                        </div>

                        <span 
                          onClick={() => handleSelectViewer(buildViewerFromGuest(seatValue, key))}
                          className="party-seat-name font-bold text-gray-200 mt-1 sm:mt-2 truncate w-full text-center drop-shadow-sm cursor-pointer hover:underline hover:text-pink-300 transition"
                        >
                          {seatValue.name}
                        </span>

                        {/* Stars Pill rating */}
                        <div className="flex items-center space-x-0.5 bg-black/75 px-1.5 py-[2px] rounded-full border border-white/10 mt-1 shadow-sm">
                          <Star size={7} className="fill-yellow-400 text-yellow-400 sm:w-[8px] sm:h-[8px]" />
                          <span className="text-[8px] sm:text-[9px] font-black text-yellow-300 font-mono leading-none">{seatValue.stars}</span>
                        </div>
                      </div>
                    ) : (
                      /* Empty Sofa Chaired Seat (Styled exactly matching screenshot 1!) */
                      <div className="flex flex-col items-center relative">
                        <button 
                          onClick={() => handleSeatClick(key)}
                          className={`party-empty-seat party-glass-tap rounded-full flex items-center justify-center transform active:scale-95 cursor-pointer ${
                            lockedSeats[key]
                              ? "party-glass-seat-locked text-red-400 hover:border-red-500/50"
                              : "party-glass-seat-guest"
                          }`}
                        >
                          {lockedSeats[key] ? (
                            <Lock size={11} className="text-red-400 animate-pulse sm:w-[15px] sm:h-[15px]" />
                          ) : (
                            <Sofa size={16} strokeWidth={2.2} className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                        <span className="text-[9px] sm:text-[10px] font-black mt-1 sm:mt-2 tracking-wider inline-flex items-center space-x-0.5 sm:space-x-1 uppercase">
                          <span className={lockedSeats[key] ? "text-red-400/80" : "party-guest-seat-number"}>NO.{sNum}</span>
                          {lockedSeats[key] && <Lock size={5} className="text-red-500 sm:w-[7px] sm:h-[7px]" />}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            ))}
          </div>
        </div>
        </div>

        <div
          className="w-full relative z-10 flex-1 min-h-0 mt-2 sm:mt-4 bg-transparent border-none overflow-hidden party-chat-grid room-conversation px-3 sm:px-4"
          id="chat_and_action_container"
        >
          
          {/* Left panel: Chat stream module */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col justify-end space-y-1.5 text-left h-full overflow-hidden" id="chat-feed-module">
            
            {/* Scrollable chat messages container */}
            <div
              className="party-chat-scroll overflow-y-auto space-y-2 pr-1 scrollbar-hide pb-0 flex flex-col min-h-0 flex-1"
              ref={chatScrollRef}
              onScroll={handleChatScroll}
            >
              {isFullPartyMode ? (
                /* EXACT MATCH SCREENSHOT WITH GUESTS MESSAGES */
                <div className="space-y-3 animate-fade-in" id="screenshot_guests_messages_list" ref={chatMessagesRef}>
                  {selfRoomWelcome ? (
                    <RoomAnnouncementChatPin
                      welcome={selfRoomWelcome}
                      roomLevel={roomExpProgress.level}
                      ownerName={roomOwnerChatIdentity.name}
                      ownerAvatar={roomOwnerChatIdentity.avatarUrl}
                      ownerRoleFlags={roomOwnerRoleFlags}
                      onSelectOwner={handleSelectRoomOwner}
                      onSelectRecipient={() =>
                        handleSelectViewer({
                          id: self.id,
                          name: self.roomName,
                          avatar: self.avatarUrl,
                          isFollowing: false,
                          isAdmin: isRoomAdminOrOwner(currentUserRole),
                          isOwner: isRoomOwner(currentUserRole),
                        })
                      }
                    />
                  ) : null}

                  {/* Message 2: Boy 100141358728 Bubble */}
                  <div className="flex flex-col space-y-1 pl-[2px]" id="boy-chat-block">
                    <div className="flex items-center space-x-1.5">
                      <img 
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80" 
                        className="party-chat-avatar rounded-full object-cover border border-purple-500/30" 
                        alt="" 
                      />
                      <span className="party-chat-username font-black text-gray-300 uppercase">
                        @100141358728
                      </span>
                    </div>
                    <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl px-2.5 py-1.5 text-left w-fit max-w-[85%] party-chat-bubble-indent">
                      <p className="party-chat-bubble-text font-bold text-[#faf9f3] tracking-wide">hello guys</p>
                    </div>
                  </div>

                  {/* Real-time Mapped Feed */}
                  {liveChatMsgs.map((m) => {
                    if (m.isAnnouncementWelcome) {
                      return renderAnnouncementWelcome(m);
                    }
                    if (m.isSingEvent) {
                      return renderSingChatEvent(m);
                    }
                    if (m.isJoinEvent) {
                      return renderJoinChatEvent(m);
                    }
                    if (m.isGiftEvent) {
                      return renderGiftChatEvent(m);
                    }
                    return renderStandardChatMessage(m);
                  })}
                </div>
              ) : (
                /* EMPTY SEATS USER MESSAGES FEED */
                <div className="space-y-1.5" ref={chatMessagesRef}>
                  {messages.filter(m => !m.isSystem).map((m, idx) => {
                    if (m.isJoinEvent) {
                      return renderJoinChatEvent({ ...m, id: `join-msg-${idx}` });
                    }
                    return renderStandardChatMessage({ ...m, id: `chat-msg-${idx}` });
                  })}
                </div>
              )}
              <div ref={chatEndRef} aria-hidden="true" className="h-px w-full shrink-0" />
            </div>

            {/* In EMPTY SEATS mode (Screenshot 1), the "Seated automatically in this room" banner is at the bottom of the chat area */}
            {!isFullPartyMode && (
              <div className="flex items-center space-x-2.5 mt-1 shrink-0" id="room-system-status-bubble-bottom">
                <div className="w-[30px] h-[30px] rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_8px_rgba(59,130,246,0.2)] shrink-0">
                  <Volume2 size={14} className="text-white" />
                </div>
                <div className="bg-[#1e1124]/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/5 text-[9px] font-black text-[#02faab] tracking-wide uppercase">
                  Seated automatically in this room
                </div>
              </div>
            )}

          </div>

          <RoomArenaColumn
            participants={arenaParticipants}
            countdownText={formatCountdown(countdown)}
            onOpen={() => setIsArenaRankingsOpen(true)}
          />
        </div>
        </div>
      </div>
      )}

      {/* FIXED DOWNMOST INTERACTIVE FOOTER BAR CONTROL SHEET */}
      {roomMode !== 'WatchTogether' && (
        <div
          id="party-room-footer"
          className="relative z-30 shrink-0 border-t border-white/5 bg-[#07010a]/95 backdrop-blur-md pt-[10px] pb-[max(10px,env(safe-area-inset-bottom))] px-3 sm:px-4"
        >
        <div className="party-room-footer-row flex w-full min-w-0 items-center gap-2">
          {/* Rounded "Let's talk" Input Box wrapper */}
          <form onSubmit={handleSendMessage} className="flex-1 min-w-0 relative">
            {/* Mention Suggestions Popup */}
            {mentionSearch !== null && (
              <div className="absolute bottom-full left-0 mb-4 w-48 bg-[#1a0f2e]/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden z-[100] animate-in fade-in slide-in-from-bottom-4">
                <div className="max-h-48 overflow-y-auto scrollbar-hide py-1">
                  {getMentionSuggestions().length > 0 ? (
                    getMentionSuggestions().map((user, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectMention(user.name)}
                        className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 hover:bg-white/10 transition-all text-left group"
                      >
                        <div className="relative">
                          <img src={safeAvatarUrl(user.avatar)} className="w-7 h-7 rounded-full object-cover border border-white/10 group-hover:border-purple-400/50 transition-colors" />
                          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-[#1a0f2e]" />
                        </div>
                        <span className="text-xs text-gray-200 group-hover:text-white font-bold truncate tracking-tight">{user.name}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-[10px] text-gray-500 text-center font-medium italic">No users found</div>
                  )}
                </div>
              </div>
            )}
            <input 
              type="text"
              value={chatInput}
              onChange={e => handleChatInputChange(e.target.value)}
              placeholder="Let's talk" 
              className="party-glass-input w-full rounded-full py-2.5 pl-4 pr-10 text-[12.5px] text-white placeholder-gray-400"
            />
          </form>

          {/* Tray Buttons matching screenshot */}
          <div className="party-room-footer-actions flex items-center gap-1.5 shrink-0">
            {roomMode === 'Chorus' && (
                <>
                <div className="w-9 h-9 rounded-full bg-gradient-to-b from-blue-700 to-blue-900 border border-blue-400/30 flex items-center justify-center text-white text-[9px] font-black shadow-lg">
                    PK
                </div>
                </>
            )}
            
            <button
                type="button"
                onClick={handleFooterMyMicClick}
                title={
                  userSeatKey
                    ? userMicOn
                      ? "Mute your microphone"
                      : userMicAdminMuted
                        ? "Your mic is locked by the host"
                        : "Unmute your microphone"
                    : "Take a seat to use your microphone"
                }
                aria-label={
                  userSeatKey
                    ? userMicOn
                      ? "Mute your microphone"
                      : "Unmute your microphone"
                    : "Take a seat to use your microphone"
                }
                className={`w-9 h-9 rounded-full border flex items-center justify-center active:scale-90 transition ${
                  userSeatKey
                    ? userMicOn
                      ? userVoiceActive
                        ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.45)] animate-pulse'
                        : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                      : 'bg-red-500/15 border-red-500/40 text-red-300'
                    : 'party-glass-tap text-gray-300'
                }`}
            >
                {userSeatKey && !userMicOn ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
                type="button"
                onClick={handleFooterSeatManagementClick}
                title="Join a seat and guest management"
                aria-label="Join a seat and guest management"
                className={`w-9 h-9 rounded-full border flex items-center justify-center active:scale-90 transition ${
                  isGuestManagementOpen
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                    : "party-glass-tap text-gray-300"
                }`}
            >
                <Users size={16} />
            </button>
            {canEditRoomAnnouncement && (
              <button
                type="button"
                onClick={handleOpenRoomModePicker}
                title="Change room mode"
                aria-label="Change room mode"
                className="w-9 h-9 rounded-full party-glass-tap flex items-center justify-center text-gray-300 active:scale-90 transition cursor-pointer"
              >
                <LayoutGrid size={16} />
              </button>
            )}
            {canChangeRoomBackground && (
            <div className="relative">
                <button 
                    type="button"
                    onClick={handleOpenRoomBackgroundMenu}
                    title="Change room background"
                    aria-label="Change room background"
                    className="w-9 h-9 rounded-full party-glass-tap flex items-center justify-center text-gray-300 active:scale-90 transition cursor-pointer"
                >
                    <Menu size={16} />
                </button>
                <span className="absolute -top-1 -right-1 bg-red-500 text-[7px] font-bold px-1 rounded-full border border-black">99+</span>
            </div>
            )}
            <button
              type="button"
              onClick={() => setIsGiftPickerOpen(true)}
              title="Send a gift"
              aria-label="Send a gift"
              className="w-9 h-9 rounded-[10px] bg-gradient-to-tr from-pink-500 to-yellow-400 p-[1px] active:scale-90 transition"
            >
                <div className="w-full h-full bg-[#0d011c] rounded-[9px] flex items-center justify-center">
                    <Gift size={16} className="text-yellow-400" />
                </div>
            </button>
          </div>
        </div>
      </div>
      )}

      {isGiftPickerOpen && (
        <div className="fixed inset-0 z-[190] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-sm bg-[#1c1130] border border-pink-500/30 rounded-[24px] p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-white">Send Gift</h3>
              <button type="button" onClick={() => setIsGiftPickerOpen(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mb-3">
              To:{' '}
              <span className="text-pink-300 font-bold">{defaultGiftReceiver()?.name ?? 'No seated guest'}</span>
              {' · '}
              Room total:{' '}
              <span className="text-yellow-300 font-bold">{roomGiftSummary.totalStars.toLocaleString()} ⭐</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PARTY_GIFT_CATALOG.map((gift) => (
                <button
                  key={gift.name}
                  type="button"
                  onClick={() => handleSendPartyGift(gift)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-2 hover:border-pink-500/40 hover:bg-pink-950/20 active:scale-95 transition"
                >
                  <span className="text-2xl">{gift.icon}</span>
                  <span className="text-[9px] font-bold text-gray-200">{gift.name}</span>
                  <span className="text-[8px] font-black text-yellow-300">{gift.stars} ⭐</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {profilePreviewUser ? (
        <RoomProfilePreviewModal
          preview={profilePreviewUser}
          onClose={closeProfilePreview}
          onToggleFollow={() => {
            const viewer = viewers.find((entry) => entry.id === profilePreviewUser.id);
            if (viewer) {
              handleToggleFollow(viewer.id);
              return;
            }
            const resolvedId = profilePreviewUser.resolvedUserId;
            if (resolvedId) handleToggleFollow(resolvedId);
          }}
          onMention={
            profilePreviewUser.isSelf
              ? undefined
              : () => {
                  const mention = profilePreviewUser.mentionLabel.replace(/^@/, '');
                  setChatInput((prev) => {
                    if (prev.endsWith(' ') || prev === '') {
                      return `${prev}@${mention} `;
                    }
                    return `${prev} @${mention} `;
                  });
                  closeProfilePreview();
                  showToast(`Added @${mention} mention to chat input`);
                }
          }
          showKick={
            (isRoomOwner(currentUserRole) && !isRoomSelfName(profilePreviewUser.displayName, self)) ||
            (currentUserRole === 'admin' &&
              !isRoomSelfName(profilePreviewUser.displayName, self) &&
              !profilePreviewUser.isOwner &&
              !profilePreviewUser.isAdmin)
          }
          onKick={() => {
            handleKickUser(profilePreviewUser.id, profilePreviewUser.displayName);
          }}
        />
      ) : null}

      <ShareModal
        isOpen={isShareRoomOpen}
        onClose={() => setIsShareRoomOpen(false)}
        shareUrl={partySharePayload.shareUrl}
        itemTitle={partySharePayload.itemTitle}
        shareText={partySharePayload.shareText}
        kind={partySharePayload.kind}
        notificationText={partySharePayload.notificationText}
      />

      {isQueueSheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[190] pointer-events-none flex justify-center">
          <div className="pointer-events-auto w-full max-w-md bg-[#12081f] border-t border-purple-500/30 rounded-t-3xl p-4 shadow-[0_-8px_32px_rgba(0,0,0,0.45)]">
            <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mb-3" />
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-white">Queue list</h3>
              <button
                type="button"
                onClick={() => setIsQueueSheetOpen(false)}
                className="text-[10px] font-bold text-pink-300 hover:text-pink-200 transition"
              >
                Close
              </button>
            </div>
            {currentlySinging && currentSingerName && (
              <p className="text-[10px] text-gray-300 mb-2">
                Now singing: <span className="text-pink-300 font-bold">{formatRoomSelfLabel(currentSingerName, self)}</span>
                {' - '}
                <span className="text-white font-bold">{currentlySinging.title}</span>
              </p>
            )}
            {songQueue.length === 0 ? (
              <p className="text-xs text-gray-400 py-3">No songs in queue.</p>
            ) : (
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {songQueue.map((queuedSong, index) => (
                  <div
                    key={`${queuedSong.id}-${index}`}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-purple-300 font-black">#{index + 1} in line</p>
                        <p className="text-xs text-white font-bold truncate">{queuedSong.title}</p>
                        <p className="text-[10px] text-gray-300 truncate">
                          {queuedSong.artist} · {formatRoomSelfLabel(queuedSong.requestedBy, self)}
                        </p>
                      </div>
                      {(isRoomAdminOrOwner(currentUserRole) ||
                        (queuedSong.requestedByUserId
                          ? queuedSong.requestedByUserId === self.id
                          : isRoomSelfName(queuedSong.requestedBy, self))) && (
                        <button
                          type="button"
                          onClick={() => removeQueuedSong(index)}
                          className="text-[9px] font-bold text-red-300 hover:text-red-200 transition"
                          aria-label="Remove queued song"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-3">
              Songs play in order automatically after each performance ends.
            </p>
          </div>
        </div>
      )}

      {roomSettingsOverlay ? (
        <div className="absolute inset-0 z-[280] flex flex-col overflow-hidden bg-background text-foreground">
          {roomSettingsOverlay.view === 'details' ? (
            <RoomDetailsScreen
              roomId={roomDisplayId}
              onBack={closeRoomSettingsOverlay}
              onOpenEdit={openRoomEditFromDetails}
            />
          ) : (
            <EditRoomScreen
              roomId={roomDisplayId}
              embedded
              onBack={handleRoomSettingsOverlayBack}
            />
          )}
        </div>
      ) : null}

    </div>
  );
}
